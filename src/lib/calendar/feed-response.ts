import "server-only";
import { checkRateLimit } from "@/lib/ratelimit";

/**
 * Respuestas de las rutas de suscripción (milestone 45). Las abre un cliente de calendario sin
 * sesión, así que un error no explica nada (no revela si un id existe): 404 seco.
 */

/** Saca la firma de `<firma>.ics`. */
export function signatureFromFile(file: string): string | null {
  const m = /^([A-Za-z0-9_-]{16,64})\.ics$/.exec(file);
  return m ? m[1] : null;
}

export function notFound(): Response {
  return new Response("No encontrado", {
    status: 404,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

export function icsResponse(body: string, filename: string): Response {
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `inline; filename="${filename}"`,
      // Corto: los clientes ya espacian las lecturas, y un cambio tiene que llegar en la próxima.
      "Cache-Control": "private, max-age=300",
      "X-Robots-Tag": "noindex",
    },
  });
}

/**
 * Límite por enlace (no por IP: Google lee desde muchas IPs suyas). Generoso: un cliente normal
 * lee cada varias horas; esto solo frena un enlace filtrado usado en bucle.
 */
export async function feedRateLimited(key: string): Promise<boolean> {
  const { allowed } = await checkRateLimit(key, "/api/calendar", {
    maxAttempts: 120,
    windowMs: 60 * 60 * 1000,
  });
  return !allowed;
}
