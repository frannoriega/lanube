/**
 * Escapa texto para meterlo en el HTML de un correo. Todo texto que no escribimos nosotros
 * (nombres de evento, motivos, respuestas) pasa por acá antes de interpolarse. Una sola copia
 * (milestone 44): antes había tres iguales en distintos módulos de correo.
 */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
