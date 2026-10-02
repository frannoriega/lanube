"use client";

import {
  browserSupportsWebAuthn,
  startAuthentication,
  startRegistration,
  WebAuthnError,
  type PublicKeyCredentialCreationOptionsJSON,
  type PublicKeyCredentialRequestOptionsJSON,
} from "@simplewebauthn/browser";
import { signIn } from "next-auth/react";
import { apiErrorMessage, apiSend } from "@/lib/api/client";
import type { PasskeyItem } from "@/types/api";

/**
 * Lado del navegador de las passkeys (milestone 17). Cada función hace la vuelta completa:
 * pide el desafío al servidor, abre el diálogo del sistema y manda la respuesta.
 */

export { browserSupportsWebAuthn };

/**
 * El usuario cerró o canceló el diálogo del sistema. No es un error para mostrar en rojo:
 * quien llama lo usa para no tirar un toast de error por una cancelación.
 */
export class PasskeyCancelledError extends Error {
  constructor() {
    super("Cancelado");
    this.name = "PasskeyCancelledError";
  }
}

/**
 * Error de passkey con un mensaje pensado para mostrarle al usuario (los de WebAuthn vienen
 * en inglés y técnicos). `passkeyErrorMessage` lo prioriza sobre el genérico.
 */
export class PasskeyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PasskeyError";
  }
}

/** Mensaje para un toast: el de `PasskeyError` o el del servidor, o `fallback`. */
export function passkeyErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof PasskeyError) return err.message;
  return apiErrorMessage(err, fallback);
}

/** Traduce los errores de WebAuthn del navegador a algo que se pueda mostrar. */
function translate(err: unknown, kind: "create" | "get"): Error {
  // El usuario canceló, o se venció el tiempo del diálogo del sistema. La librería a veces
  // envuelve el `NotAllowedError` como "passthrough" y deja el original en `cause`.
  const cause = (err as { cause?: unknown })?.cause;
  if (
    (err instanceof Error && err.name === "NotAllowedError") ||
    (cause instanceof Error && cause.name === "NotAllowedError") ||
    (err instanceof WebAuthnError && err.code === "ERROR_CEREMONY_ABORTED")
  ) {
    return new PasskeyCancelledError();
  }
  if (
    err instanceof WebAuthnError &&
    err.code === "ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED"
  ) {
    return new PasskeyError(
      "Este dispositivo ya tiene una passkey de tu cuenta",
    );
  }
  console.error("[passkeys] WebAuthn falló", err);
  return new PasskeyError(
    kind === "create"
      ? "Tu dispositivo no pudo crear la passkey. Probá de nuevo o con otro dispositivo."
      : "Tu dispositivo no pudo usar la passkey. Probá de nuevo o entrá con tu contraseña.",
  );
}

/** Nombre sugerido para una passkey nueva, según el dispositivo. El usuario lo puede cambiar. */
export function suggestPasskeyLabel(): string {
  if (typeof navigator === "undefined") return "Mi passkey";
  const ua = navigator.userAgent;
  if (/iPhone/.test(ua)) return "iPhone";
  if (/iPad/.test(ua)) return "iPad";
  if (/Android/.test(ua)) return "Android";
  if (/Macintosh|Mac OS X/.test(ua)) return "Mac";
  if (/Windows/.test(ua)) return "Windows";
  if (/Linux/.test(ua)) return "Linux";
  return "Mi passkey";
}

/** Crea una passkey para la cuenta con sesión y la guarda con el nombre dado. */
export async function registerPasskey(label: string): Promise<PasskeyItem> {
  const { challengeId, options } = await apiSend<{
    challengeId: string;
    options: PublicKeyCredentialCreationOptionsJSON;
  }>("/api/user/passkeys/options", "POST");

  let response;
  try {
    response = await startRegistration({ optionsJSON: options });
  } catch (err) {
    throw translate(err, "create");
  }

  return apiSend<PasskeyItem>("/api/user/passkeys", "POST", {
    challengeId,
    label,
    response,
  });
}

/**
 * Inicia sesión con una passkey. Devuelve la URL a la que navegar, o lanza:
 * `PasskeyCancelledError` si el usuario canceló, o un `Error` con un mensaje mostrable.
 */
export async function signInWithPasskey(redirectTo: string): Promise<string> {
  const { challengeId, options } = await apiSend<{
    challengeId: string;
    options: PublicKeyCredentialRequestOptionsJSON;
  }>("/api/auth/passkey/options", "POST");

  let response;
  try {
    response = await startAuthentication({ optionsJSON: options });
  } catch (err) {
    throw translate(err, "get");
  }

  const res = await signIn("passkey", {
    challengeId,
    response: JSON.stringify(response),
    redirect: false,
    redirectTo,
  });
  if (res?.error) {
    if (res.code === "email_not_verified") {
      throw new PasskeyError(
        "Debes confirmar tu correo electrónico antes de iniciar sesión. Revisa tu bandeja de entrada.",
      );
    }
    throw new PasskeyError(
      "No reconocimos esa passkey. Puede que la hayas borrado de tu cuenta: entrá con tu contraseña.",
    );
  }
  if (!res?.url)
    throw new PasskeyError("No pudimos iniciar sesión. Intentá de nuevo.");
  return res.url;
}
