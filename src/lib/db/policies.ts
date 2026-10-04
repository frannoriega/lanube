import "server-only";
import type {
  PolicyAcceptanceContext,
  Prisma,
} from "@/generated/prisma/client";
import { nowMs } from "@/lib/clock";
import { pendingPolicies, type PendingPolicy } from "@/lib/policies/pending";
import { POLICIES } from "@/lib/policies/registry";
import { prisma } from "@/lib/prisma";

/**
 * Acceso a `policy_acceptances` (milestone 19). **Solo inserta y lee**: la tabla es
 * append-only (además lo impone un trigger en la base). No agregues un `update` ni un
 * `delete` acá — una aceptación es evidencia legal.
 */

/** Cliente de Prisma o transacción: el alta inserta dentro de la misma transacción que el `User`. */
type Db = Prisma.TransactionClient | typeof prisma;

/** Una aceptación tal como se muestra al usuario y al admin. */
export interface PolicyAcceptanceRow {
  policyKey: string;
  version: string;
  context: PolicyAcceptanceContext;
  acceptedAt: number;
}

/** Una aceptación tal como la muestra Configuración → Cuenta. */
export interface AcceptedPolicyItem {
  policyKey: string;
  title: string;
  /** Enlace a la versión exacta aceptada, o null si el registro ya no conoce la política. */
  href: string | null;
  version: string;
  acceptedAt: number;
  context: "SIGNUP" | "REACCEPT";
}

/** Datos de la request que aceptó, guardados como evidencia (ver `policies.prisma`). */
export interface AcceptanceEvidence {
  ipAddress: string | null;
  userAgent: string | null;
}

/** Todas las aceptaciones de una cuenta, la más nueva primero. */
export async function listPolicyAcceptances(
  userId: string,
): Promise<PolicyAcceptanceRow[]> {
  const rows = await prisma.policyAcceptance.findMany({
    where: { userId },
    orderBy: { acceptedAt: "desc" },
    select: { policyKey: true, version: true, context: true, acceptedAt: true },
  });
  return rows.map((r) => ({ ...r, acceptedAt: Number(r.acceptedAt) }));
}

/**
 * Lo que una cuenta tiene pendiente de aceptar ahora mismo. Una consulta chica (las filas de
 * aceptación del usuario) + la regla pura `pendingPolicies()`. La llama el callback `jwt()` en
 * cada request autenticada, igual que el chequeo de baneo.
 */
export async function getPendingPoliciesForUser(
  userId: string,
  atMs: number = nowMs(),
): Promise<PendingPolicy[]> {
  const rows = await prisma.policyAcceptance.findMany({
    where: { userId },
    select: { policyKey: true, version: true },
  });
  return pendingPolicies(POLICIES, rows, atMs);
}

/**
 * Registra la aceptación de cada política de `accepted` en su versión y hash **del servidor**
 * (nunca los que mandó el cliente; ver `checkSubmittedAcceptances`).
 *
 * `skipDuplicates`: si el usuario acepta dos veces la misma versión (doble clic, dos
 * pestañas), la segunda no falla ni duplica — y la fila original, con su fecha, se conserva.
 */
export async function recordPolicyAcceptances(
  db: Db,
  userId: string,
  accepted: readonly PendingPolicy[],
  context: PolicyAcceptanceContext,
  evidence: AcceptanceEvidence,
): Promise<void> {
  if (accepted.length === 0) return;
  await db.policyAcceptance.createMany({
    data: accepted.map((p) => ({
      userId,
      policyKey: p.key,
      version: p.version,
      contentHash: p.sha256,
      context,
      ipAddress: evidence.ipAddress,
      userAgent: evidence.userAgent?.slice(0, 512) ?? null,
    })),
    skipDuplicates: true,
  });
}
