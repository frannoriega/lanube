import "server-only";
import { headers } from "next/headers";
import type { AcceptanceEvidence } from "@/lib/db/policies";
import { getClientIp } from "@/lib/request-ip";

/**
 * IP y user-agent de la request actual, para guardar con una aceptación de política
 * (milestone 19). La IP sale de `getClientIp()`, que solo confía en headers que pone la
 * plataforma — una IP falsificable no serviría como evidencia. Cualquiera de los dos puede ser
 * `null`; la aceptación se registra igual.
 */
export async function getAcceptanceEvidence(): Promise<AcceptanceEvidence> {
  const h = await headers();
  return {
    ipAddress: await getClientIp(),
    userAgent: h.get("user-agent"),
  };
}
