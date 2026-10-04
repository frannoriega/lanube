import "server-only";
import { nowMs } from "@/lib/clock";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { getRoleById, permissionSetOf } from "./db/roles";
import NextAuth from "next-auth";
import type { DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import {
  getRegisteredUserByEmail,
  getUserByEmailAndPassword,
} from "./db/users";
import { normalizeEmailForIdentityServer } from "./email/identity-server";
import { logger } from "@/lib/logger";
import { prisma } from "./prisma";
import { CredentialsSignin } from "next-auth";
import { signInSchema } from "./schemas/auth";
import { passkeyAuthenticationSchema } from "./schemas/passkeys";
import { verifyPasskeyAuthentication } from "./passkeys/server";
import { getPendingPoliciesForUser } from "./db/policies";
import type { AuthenticationResponseJSON } from "@simplewebauthn/server";

const SESSION_EXPIRATION_TIME_MS = 1000 * 7 * 24 * 60 * 60; // 7 days

declare module "next-auth" {
  interface Session {
    banned: boolean;
    bannedReason: string;
    bannedUntil: Date;
    /** Display name of the user's role, or null on the base tier. */
    role: string | null;
    /** Resolved catalog permissions (milestone 9 — roles are data, not an enum). */
    permissions: string[];
    /** Protected owner tier: implicitly holds every permission. */
    isSuperadmin: boolean;
    userId: string;
    /**
     * Hay políticas que la cuenta tiene que aceptar (milestone 19). Recalculado en cada
     * `jwt()` desde el registro + `policy_acceptances`; nunca viene del cliente.
     */
    policiesPending: boolean;
    user: DefaultSession["user"] & {
      /** Original signup / display form; fall back to `email` in UI when null. */
      displayEmail?: string | null;
    };
  }

  interface JWT {
    banned: boolean;
    bannedReason: string;
    bannedUntil: Date;
    role: string | null;
    permissions: string[];
    isSuperadmin: boolean;
    userId: string;
    /** True when a `RegisteredUser` row exists (JWT-safe; never store Prisma rows here — BigInt breaks `JSON.stringify`). */
    signedUp: boolean;
    displayEmail?: string | null;
    /** Ver `Session.policiesPending`. Lo lee el middleware para el gate. */
    policiesPending: boolean;
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    Credentials({
      credentials: {
        email: {
          type: "email",
          label: "Email",
          placeholder: "jejemplo@gmail.com",
        },
        password: {
          type: "password",
          label: "Contraseña",
          placeholder: "*****",
        },
      },
      authorize: async (credentials) => {
        try {
          const { email, password } =
            await signInSchema.parseAsync(credentials);
          const normalizedEmail = await normalizeEmailForIdentityServer(email);
          const user = await getUserByEmailAndPassword(
            normalizedEmail,
            password,
          );
          if (!user) return null;
          if (!user.emailVerified) {
            const err = new CredentialsSignin(
              "Debes confirmar tu correo electrónico antes de iniciar sesión. Revisa tu bandeja de entrada.",
            );
            err.code = "email_not_verified";
            throw err;
          }
          // Only JWT-serializable fields (no BigInt, no passwordHash).
          return {
            id: user.id,
            email: user.email,
            name: user.name ?? undefined,
            image: user.image ?? undefined,
          };
        } catch (error) {
          if (error instanceof CredentialsSignin) throw error;
          return null;
        }
      },
    }),
    /**
     * Inicio de sesión con passkey (milestone 17). El cliente pide un desafío a
     * `POST /api/auth/passkey/options`, el navegador lo firma, y acá se verifica la firma
     * (`verifyPasskeyAuthentication`). Devuelve el mismo usuario "JWT-safe" que el proveedor
     * de contraseña, así el callback `jwt()` — baneos, permisos, perfil completo — trata
     * igual a los dos.
     */
    Credentials({
      id: "passkey",
      name: "Passkey",
      credentials: {
        challengeId: { type: "text" },
        response: { type: "text" },
      },
      authorize: async (credentials, request) => {
        try {
          const parsed = passkeyAuthenticationSchema.safeParse({
            challengeId: credentials?.challengeId,
            response:
              typeof credentials?.response === "string"
                ? JSON.parse(credentials.response)
                : undefined,
          });
          if (!parsed.success) return null;
          const user = await verifyPasskeyAuthentication(
            {
              challengeId: parsed.data.challengeId,
              response: parsed.data
                .response as unknown as AuthenticationResponseJSON,
            },
            request,
          );
          if (!user) return null;
          if (!user.emailVerified) {
            const err = new CredentialsSignin(
              "Debes confirmar tu correo electrónico antes de iniciar sesión. Revisa tu bandeja de entrada.",
            );
            err.code = "email_not_verified";
            throw err;
          }
          return {
            id: user.id,
            email: user.email,
            name: user.name ?? undefined,
            image: user.image ?? undefined,
          };
        } catch (error) {
          if (error instanceof CredentialsSignin) throw error;
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async session({ session, token }) {
      if (token) {
        session.banned = token.banned as boolean;
        session.bannedReason = token.bannedReason as string;
        session.bannedUntil = token.bannedUntil as Date;
        session.role = (token.role as string | null) ?? null;
        session.permissions = Array.isArray(token.permissions)
          ? (token.permissions as string[])
          : [];
        session.isSuperadmin = token.isSuperadmin === true;
        session.userId = token.userId as string;
        session.policiesPending = token.policiesPending === true;
        if (session.user) {
          session.user.displayEmail =
            (token.displayEmail as string | null | undefined) ?? null;
        }
        if (token.exp) {
          session.expires = new Date(token.exp * 1000) as Date & string;
        }
      }
      return session;
    },
    async jwt({ token }) {
      if (token && token.email) {
        const registeredUser = await getRegisteredUserByEmail(token.email);
        // Gate de políticas (milestone 19): se calcula sobre la cuenta (`User`), haya o no
        // perfil completo — una cuenta creada antes de este milestone acepta antes de
        // completar el perfil. Una consulta chica por llamada, como el baneo y el rol.
        const accountId =
          registeredUser?.userId ??
          (
            await prisma.user.findUnique({
              where: { email: token.email },
              select: { id: true },
            })
          )?.id;
        token.policiesPending = accountId
          ? (await getPendingPoliciesForUser(accountId)).length > 0
          : false;
        if (registeredUser) {
          const atMs = nowMs();
          const defaultExp = atMs + SESSION_EXPIRATION_TIME_MS;
          const activeBan = registeredUser.bans[0] ?? null;
          token.signedUp = true;
          // Roles are data now, so the token carries the RESOLVED permission list —
          // middleware needs it to stay a DB-free fast path. Recomputed here on every
          // jwt() call (same freshness contract the role string had before), so a role
          // edit reaches middleware on the session's next touch rather than at re-auth.
          const role = await getRoleById(registeredUser.roleId);
          const resolved = permissionSetOf(role);
          token.role = role?.name ?? null;
          token.permissions = [...resolved.permissions];
          token.isSuperadmin = resolved.isSuperadmin;
          token.userId = registeredUser.id;
          token.displayEmail =
            registeredUser.user.displayEmail ?? registeredUser.user.email;
          if (activeBan) {
            const banEndMs =
              activeBan.endTime != null ? Number(activeBan.endTime) : Infinity;
            const minExp = Math.min(banEndMs, defaultExp);
            token.banned = true;
            token.bannedUntil =
              activeBan.endTime != null
                ? new Date(Number(activeBan.endTime))
                : new Date(defaultExp);
            token.bannedReason = activeBan.reason;

            token.exp = Math.floor(minExp / 1000);
          } else {
            token.banned = false;
            token.exp = Math.floor(defaultExp / 1000);
          }
        } else {
          token.signedUp = false;
          token.displayEmail = undefined;
          token.role = null;
          token.permissions = [];
          token.isSuperadmin = false;
        }
      }
      return token;
    },
  },
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/auth/signin",
    newUser: "/auth/signup",
  },
});

/**
 * Valida un token de Turnstile contra Cloudflare.
 *
 * ⚠️ El fallback anterior era `1x0000000000000000000000000000000AA`, que es la clave de
 * **prueba** de Turnstile: la que siempre responde `success: true`. Es decir, si
 * `TURNSTILE_SECRET_KEY` faltaba en producción el captcha quedaba desactivado en silencio
 * justo en los dos endpoints que más lo necesitan (registro y reset de contraseña), y no
 * había forma de notarlo desde afuera. Ahora fuera de desarrollo la falta de clave hace
 * fallar la verificación (milestone-12 D25).
 */
async function verifyCaptcha(captcha: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      logger.error(
        "verifyCaptcha: falta TURNSTILE_SECRET_KEY — se rechaza la verificación",
      );
      return false;
    }
    logger.warn(
      "verifyCaptcha: sin TURNSTILE_SECRET_KEY, usando la clave de prueba de Turnstile (solo desarrollo)",
    );
  }

  try {
    const res = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          secret: secret ?? "1x0000000000000000000000000000000AA",
          response: captcha,
        }),
      },
    );
    const data = await res.json();
    return data.success === true;
  } catch (error) {
    // Falla cerrada: si no se pudo verificar, no se asume que el usuario es humano.
    logger.error("verifyCaptcha falló", error);
    return false;
  }
}

export { verifyCaptcha };
