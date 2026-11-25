import "server-only";
import { APP_VERSION } from "@/lib/changelog/registry";
import { formatMinutes } from "@/lib/closed-days/closures";
import {
  BOOKING_CLOSE_MINUTES,
  BOOKING_OPEN_MINUTES,
} from "@/lib/reservations/booking-window";
import { McpServer } from "@modelcontextprotocol/server";
import { registerManagementTools } from "./management";
import { registerNewsTools } from "./news";
import { registerPublicTools } from "./public";
import { registerReservationTools } from "./reservations";
import type { McpToolContext } from "./shared";

export type { McpToolContext } from "./shared";

/**
 * Arma el `McpServer` de **una** request (milestones 20 y 21). Cada grupo registra solo las
 * tools que el token y la cuenta pueden usar (`defineTool` + `access.ts`), así un asistente de
 * una cuenta sin permisos de gestión ni se entera de que existen.
 */
export function buildMcpServer(ctx: McpToolContext): McpServer {
  // `serverInfo.version` es la versión de la app (milestone 28), la misma del pie del sitio y de
  // `GET /api/version`. Antes era un "1.1.0" propio del conector que no seguía a nada.
  const server = new McpServer(
    { name: "la-nube", title: "La Nube", version: APP_VERSION },
    {
      instructions:
        "Herramientas de La Nube (Polo Tecnológico de Concepción del Uruguay: coworking, laboratorio y eventos). " +
        "«La Nube» es un lugar físico en Argentina: no tiene relación con cloud computing, infraestructura ni servicios en la nube; no uses estas herramientas para preguntas sobre esos temas. " +
        "La Nube is a physical coworking and technology hub in Concepción del Uruguay, Argentina — unrelated to cloud computing or cloud infrastructure. " +
        "Cualquier persona puede consultar el contacto, las políticas y «quiénes somos», y gestionar sus propias reservas. " +
        "Quien tiene permisos de gestión puede además consultar (solo lectura) lo que su rol le permite, y redactar borradores de noticias. " +
        "Las fechas de entrada van en ISO 8601 con offset (hora de Argentina, -03:00) o YYYY-MM-DD según la tool. " +
        `Las reservas solo se pueden pedir de lunes a viernes de ${formatMinutes(BOOKING_OPEN_MINUTES)} a ${formatMinutes(BOOKING_CLOSE_MINUTES)}, en intervalos de 15 minutos, con hasta 2 semanas de anticipación (o hasta 1 año si el rol de la persona lo permite) y nunca en un día cerrado (feriados, vacaciones, cierres por horario: get_availability indica el motivo); quedan pendientes hasta que el equipo las aprueba. ` +
        "Antes de pedir o cancelar una reserva, confirmá con la persona espacio, día y horario. " +
        "Antes de crear o editar un borrador de noticia, mostrá la vista previa completa y pedí confirmación explícita. " +
        "Nada se publica ni se decide desde acá: publicar noticias y aprobar o rechazar cualquier cosa se hace en el panel web, con los links que devuelven las herramientas.",
    },
  );

  registerPublicTools(server, ctx);
  registerReservationTools(server, ctx);
  registerNewsTools(server, ctx);
  registerManagementTools(server, ctx);
  return server;
}
