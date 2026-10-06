import "server-only";
import nodemailer from "nodemailer";
import SMTPTransport from "nodemailer/lib/smtp-transport";
import { DomainError } from "@/lib/errors";
import { logger } from "@/lib/logger";

/**
 * Transporte SMTP compartido por los correos de autenticación (confirmación y reseteo).
 * Antes cada uno armaba su propia copia idéntica.
 */
export const transporter = nodemailer.createTransport({
  host: process.env.SMTP_SERVER_HOST,
  port: process.env.SMTP_SERVER_PORT,
  secure: process.env.SMTP_SERVER_SECURE === "true",
  // En el puerto 587 la conexión arranca en texto plano y se sube a TLS con STARTTLS. Por
  // defecto nodemailer sigue sin cifrar si el servidor no ofrece STARTTLS (p. ej. un atacante
  // en el camino que lo quite) y mandaría usuario y contraseña en claro. Con `requireTLS`
  // se niega a autenticar sin TLS. Solo en producción: el Mailpit local (1025) no tiene TLS.
  requireTLS: process.env.NODE_ENV === "production",
  auth: {
    user: process.env.SMTP_SERVER_USERNAME,
    pass: process.env.SMTP_SERVER_PASSWORD,
  },
} as SMTPTransport.Options);

export const FROM_EMAIL = "La Nube <no-responder@cdeluruguay.gob.ar>";

/**
 * Comprueba que el SMTP responde **antes** de tocar la base. Las rutas cuyo único fin es
 * entregar un enlace (registro, reseteo de contraseña) la llaman primero: si el correo está
 * caído fallan con 503 sin dejar cuentas a medias ni tokens huérfanos, y sin decirle a la
 * persona que "el enlace fue enviado" cuando no es cierto.
 *
 * Se llama **antes de saber si la cuenta existe**, a propósito: en el reseteo la respuesta
 * es la misma exista o no el correo (evita enumerar cuentas), y fallar solo para los que
 * existen reintroduciría esa fuga.
 *
 * Lanza un {@link DomainError} 503 con un mensaje apto para mostrar.
 */
export async function assertMailerAvailable(context: string): Promise<void> {
  try {
    await transporter.verify();
  } catch (error) {
    // Nunca se loguean las credenciales del SMTP.
    logger.error(`SMTP verify failed (${context})`, error);
    throw new DomainError(
      "No podemos enviar correos en este momento. Intentá de nuevo más tarde.",
      503,
    );
  }
}
