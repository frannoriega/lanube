import "server-only";
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type PublicKeyCredentialCreationOptionsJSON,
  type PublicKeyCredentialRequestOptionsJSON,
  type RegistrationResponseJSON,
} from "@simplewebauthn/server";
import { nowMs } from "@/lib/clock";
import { DomainError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

/**
 * Passkeys (WebAuthn) — milestone 17. Alta, baja, listado e inicio de sesión.
 *
 * Se usa `@simplewebauthn/server` para la criptografía y el protocolo, y **no** el proveedor
 * `Passkey` experimental de NextAuth: ese exige su propio modelo `Authenticator`, la bandera
 * `experimental.enableWebAuthn` y se lleva mal con la estrategia JWT que usa este proyecto.
 * En su lugar, el inicio de sesión es un segundo proveedor `Credentials` ("passkey", en
 * `src/lib/auth.ts`) cuyo `authorize` verifica la aserción con `verifyPasskeyAuthentication`.
 * El resto (callback `jwt()`, baneos, permisos) queda idéntico al de contraseña.
 *
 * Los desafíos viven en la tabla `webauthn_challenges` (5 minutos, un solo uso).
 */

/** Cuánto vive un desafío sin usar. El diálogo del navegador expira a los 60 s. */
const CHALLENGE_TTL_MS = 5 * 60 * 1000;

/** Nombre que muestra el navegador / gestor de contraseñas al crear la passkey. */
const RP_NAME = "La Nube";

/** Máximo de passkeys por cuenta — evita que una sesión robada llene la tabla. */
export const MAX_PASSKEYS_PER_USER = 10;

/**
 * Relying Party (el sitio) para esta request.
 *
 * Por defecto se toma del dominio al que entró el navegador, leído de los encabezados
 * `X-Forwarded-Host` / `Host` (y `X-Forwarded-Proto`). **No** de `request.url`: con
 * `next dev -H 0.0.0.0` (el contenedor de Docker) esa URL dice `0.0.0.0` en vez del host
 * real, y el navegador rechaza un `rpID` que no coincide con la página. Así funciona igual
 * en local, en cada preview de Vercel y en producción sin configurar nada.
 *
 * Es seguro tomarlo del pedido porque el navegador firma el origen real en el que estaba y
 * solo acepta un `rpID` que sea ese dominio o uno padre: un `Host` falsificado no produce
 * una firma válida para otro sitio. `WEBAUTHN_RP_ID` / `WEBAUTHN_ORIGIN` lo fijan a mano si
 * algún proxy reescribiera el host.
 *
 * Una passkey queda atada a su `rpID`: las creadas en producción no sirven en una preview.
 */
export function relyingParty(request: Request): {
  rpID: string;
  origin: string;
} {
  const url = new URL(request.url);
  const host =
    request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ||
    request.headers.get("host") ||
    url.host;
  const proto =
    request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ||
    url.protocol.replace(":", "");
  const origin = process.env.WEBAUTHN_ORIGIN ?? `${proto}://${host}`;
  const rpID = process.env.WEBAUTHN_RP_ID ?? new URL(origin).hostname;
  return { rpID, origin };
}

/**
 * Las passkeys cuelgan de `User` (la identidad de inicio de sesión), pero la sesión lleva
 * el id de `RegisteredUser`. Devuelve el `User.id` correspondiente, o `null`.
 */
export async function loginUserIdOf(
  registeredUserId: string,
): Promise<string | null> {
  const row = await prisma.registeredUser.findUnique({
    where: { id: registeredUserId },
    select: { userId: true },
  });
  return row?.userId ?? null;
}

// ---------------------------------------------------------------------------
// Desafíos
// ---------------------------------------------------------------------------

type ChallengePurpose = "registration" | "authentication";

async function storeChallenge(
  purpose: ChallengePurpose,
  challenge: string,
  userId: string | null,
): Promise<string> {
  const row = await prisma.webAuthnChallenge.create({
    data: {
      purpose,
      challenge,
      userId,
      expiresAt: BigInt(nowMs() + CHALLENGE_TTL_MS),
    },
    select: { id: true },
  });
  return row.id;
}

/**
 * Consume (borra) un desafío y lo devuelve si era válido para este propósito y usuario.
 * Se borra **antes** de verificar: aunque la verificación falle, el desafío ya no sirve
 * para otro intento (sin repetición).
 */
async function consumeChallenge(
  id: string,
  purpose: ChallengePurpose,
  userId: string | null,
): Promise<string | null> {
  const row = await prisma.webAuthnChallenge
    .delete({ where: { id } })
    .catch(() => null);
  if (!row) return null;
  if (row.purpose !== purpose) return null;
  if (row.userId !== userId) return null;
  if (Number(row.expiresAt) < nowMs()) return null;
  return row.challenge;
}

// ---------------------------------------------------------------------------
// Alta de una passkey (usuario con sesión)
// ---------------------------------------------------------------------------

/** Lo que el usuario ve de cada passkey suya (nunca la clave pública). */
export interface PasskeySummary {
  id: string;
  label: string;
  deviceType: string;
  backedUp: boolean;
  createdAt: bigint;
  lastUsedAt: bigint | null;
}

const SUMMARY_SELECT = {
  id: true,
  label: true,
  deviceType: true,
  backedUp: true,
  createdAt: true,
  lastUsedAt: true,
} as const;

export async function listPasskeys(userId: string): Promise<PasskeySummary[]> {
  return prisma.passkeyCredential.findMany({
    where: { userId },
    select: SUMMARY_SELECT,
    orderBy: { createdAt: "asc" },
  });
}

/**
 * Política del doc de diseño: una passkey **nunca** es la única credencial de la cuenta.
 * Solo se puede agregar a una cuenta que ya tiene otra forma de entrar. Hoy eso es la
 * contraseña (no hay OAuth todavía); cuando se sume OAuth, esta función es la que tiene
 * que mirar también las identidades vinculadas.
 */
async function hasNonPasskeyCredential(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { passwordHash: true },
  });
  return Boolean(user?.passwordHash);
}

/** Paso 1 del alta: opciones para `navigator.credentials.create()`. */
export async function startPasskeyRegistration(
  userId: string,
  request: Request,
): Promise<{
  challengeId: string;
  options: PublicKeyCredentialCreationOptionsJSON;
}> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      email: true,
      displayEmail: true,
      registeredUser: { select: { name: true, lastName: true } },
      passkeys: { select: { credentialId: true, transports: true } },
    },
  });
  if (!user) throw new DomainError("Usuario no encontrado", 404);
  if (!(await hasNonPasskeyCredential(userId))) {
    throw new DomainError(
      "Tu cuenta necesita una contraseña antes de agregar una passkey",
      409,
    );
  }
  if (user.passkeys.length >= MAX_PASSKEYS_PER_USER) {
    throw new DomainError(
      `Llegaste al máximo de ${MAX_PASSKEYS_PER_USER} passkeys. Eliminá una para agregar otra.`,
      409,
    );
  }

  const { rpID } = relyingParty(request);
  const displayName = user.registeredUser
    ? `${user.registeredUser.name} ${user.registeredUser.lastName}`
    : (user.displayEmail ?? user.email);

  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID,
    userName: user.displayEmail ?? user.email,
    userDisplayName: displayName,
    // El id de usuario WebAuthn es el de `User` — estable y sin datos personales.
    userID: new TextEncoder().encode(userId),
    attestationType: "none",
    // Que el autenticador no ofrezca crear una segunda passkey donde ya hay una.
    excludeCredentials: user.passkeys.map((p) => ({
      id: p.credentialId,
      transports: p.transports,
    })),
    authenticatorSelection: {
      // Credencial "descubrible": permite entrar sin escribir el email.
      residentKey: "required",
      userVerification: "preferred",
    },
  });

  const challengeId = await storeChallenge(
    "registration",
    options.challenge,
    userId,
  );
  return { challengeId, options };
}

/** Paso 2 del alta: verifica la respuesta del autenticador y guarda la credencial. */
export async function finishPasskeyRegistration(
  userId: string,
  input: {
    challengeId: string;
    response: RegistrationResponseJSON;
    label: string;
  },
  request: Request,
): Promise<PasskeySummary> {
  const challenge = await consumeChallenge(
    input.challengeId,
    "registration",
    userId,
  );
  if (!challenge) {
    throw new DomainError(
      "El pedido venció o ya se usó. Volvé a intentarlo.",
      400,
    );
  }

  const { rpID, origin } = relyingParty(request);
  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response: input.response,
      expectedChallenge: challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: false,
    });
  } catch (err) {
    logger.warn("passkeys/registration verify failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    throw new DomainError("No pudimos verificar la passkey", 400);
  }
  if (!verification.verified) {
    throw new DomainError("No pudimos verificar la passkey", 400);
  }

  const { credential, credentialDeviceType, credentialBackedUp } =
    verification.registrationInfo;

  try {
    return await prisma.passkeyCredential.create({
      data: {
        userId,
        credentialId: credential.id,
        publicKey: credential.publicKey,
        counter: BigInt(credential.counter),
        transports: credential.transports ?? [],
        deviceType: credentialDeviceType,
        backedUp: credentialBackedUp,
        label: input.label,
      },
      select: SUMMARY_SELECT,
    });
  } catch (err) {
    if ((err as { code?: string }).code === "P2002") {
      throw new DomainError("Esa passkey ya está registrada", 409);
    }
    throw err;
  }
}

export async function renamePasskey(
  userId: string,
  passkeyId: string,
  label: string,
): Promise<void> {
  const { count } = await prisma.passkeyCredential.updateMany({
    where: { id: passkeyId, userId },
    data: { label },
  });
  if (count === 0) throw new DomainError("Passkey no encontrada", 404);
}

/**
 * Quita una passkey. Siempre está permitido: la política es que la **última credencial que
 * no es passkey** no se pueda quitar, y borrar una passkey nunca deja a la cuenta sin su
 * contraseña.
 */
export async function deletePasskey(
  userId: string,
  passkeyId: string,
): Promise<void> {
  const { count } = await prisma.passkeyCredential.deleteMany({
    where: { id: passkeyId, userId },
  });
  if (count === 0) throw new DomainError("Passkey no encontrada", 404);
}

// ---------------------------------------------------------------------------
// Inicio de sesión (sin sesión)
// ---------------------------------------------------------------------------

/**
 * Paso 1 del inicio de sesión: un desafío sin `allowCredentials`, así el navegador ofrece
 * cualquier passkey de este sitio (no hace falta escribir el email).
 */
export async function startPasskeyAuthentication(request: Request): Promise<{
  challengeId: string;
  options: PublicKeyCredentialRequestOptionsJSON;
}> {
  const { rpID } = relyingParty(request);
  const options = await generateAuthenticationOptions({
    rpID,
    userVerification: "preferred",
  });
  const challengeId = await storeChallenge(
    "authentication",
    options.challenge,
    null,
  );
  return { challengeId, options };
}

/**
 * Paso 2: verifica la aserción y devuelve el `User` dueño de la passkey, o `null` si no
 * vale (desafío vencido, passkey desconocida, firma inválida, contador que retrocede).
 * Nunca lanza: lo llama el `authorize` de NextAuth, que trata `null` como credencial mala.
 */
export async function verifyPasskeyAuthentication(
  input: { challengeId: string; response: AuthenticationResponseJSON },
  request: Request,
): Promise<{
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  emailVerified: bigint | null;
} | null> {
  try {
    const challenge = await consumeChallenge(
      input.challengeId,
      "authentication",
      null,
    );
    if (!challenge) return null;

    const stored = await prisma.passkeyCredential.findUnique({
      where: { credentialId: input.response.id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            image: true,
            emailVerified: true,
          },
        },
      },
    });
    if (!stored) return null;

    const { rpID, origin } = relyingParty(request);
    const verification = await verifyAuthenticationResponse({
      response: input.response,
      expectedChallenge: challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: false,
      credential: {
        id: stored.credentialId,
        publicKey: new Uint8Array(stored.publicKey),
        counter: Number(stored.counter),
        transports: stored.transports,
      },
    });
    if (!verification.verified) return null;

    await prisma.passkeyCredential.update({
      where: { id: stored.id },
      data: {
        counter: BigInt(verification.authenticationInfo.newCounter),
        lastUsedAt: BigInt(nowMs()),
        backedUp: verification.authenticationInfo.credentialBackedUp,
      },
    });
    return stored.user;
  } catch (err) {
    logger.warn("passkeys/authentication verify failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}
