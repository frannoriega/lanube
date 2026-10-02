import "server-only";
import { logger } from "@/lib/logger";
import { recordAuditFromSession } from "./record";
import { pickAuditSides } from "./pick";
import {
  auditEntityDef,
  auditEventDef,
  auditFieldSpecs,
  type AuditAction,
  type AuditEntityType,
} from "./registry";
import { loadSnapshot } from "./snapshots";

/**
 * El "bus" de auditoría (milestone 16): la forma de registrar un evento desde una ruta.
 *
 * ```ts
 * const audit = await beginAudit("Event", id);   // foto de antes
 * const event = await updateEvent(id, data);      // la escritura
 * await audit.commit(session, AUDIT_ACTIONS.eventUpdate); // foto de después + entrada
 * ```
 *
 * La ruta no elige qué campos guardar ni cómo se llaman: el registro (`registry.ts`) dice
 * qué campos de la entidad se auditan, y el `kind` del evento qué lado se guarda (ver
 * `pick.ts`). Una edición que no cambió nada auditado no escribe nada. El `context`
 * ("Evento: Taller de robótica") se arma solo, con el `subject` de la entidad.
 *
 * Cada entrada pasa por `AUDIT_SUBSCRIBERS`: hoy solo la escritura en `audit_logs`, pero es
 * el punto donde engancharía, por ejemplo, una notificación o un envío a una cola sin tocar
 * ninguna ruta. Igual que `recordAudit`, **nunca lanza**: una auditoría rota no puede
 * romper la operación que documenta.
 */

/** Lo que reciben los suscriptores: una entrada lista para guardar. */
export interface AuditEntry {
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  context: Record<string, string> | null;
  reason: string | null;
  requestId: string | null;
}

export type AuditSubscriber = (
  session: { userId: string },
  entry: AuditEntry,
) => Promise<void>;

/** Destinos de cada entrada, en orden. El primero es el registro en la base. */
const AUDIT_SUBSCRIBERS: AuditSubscriber[] = [
  (session, entry) => recordAuditFromSession(session, entry),
];

async function publish(session: { userId: string }, entry: AuditEntry) {
  for (const subscriber of AUDIT_SUBSCRIBERS) {
    try {
      await subscriber(session, entry);
    } catch (err) {
      logger.error("audit/subscriber", err, {
        action: entry.action,
        entityId: entry.entityId,
      });
    }
  }
}

export interface CommitOptions {
  /** Id del registro, cuando no se conocía al empezar (un alta). */
  entityId?: string;
  /** Datos de identificación extra, además del `subject` de la entidad. */
  context?: Record<string, string>;
  reason?: string | null;
  requestId?: string | null;
  /**
   * Campos que no salen de la foto (p. ej. las sesiones canceladas en el mismo guardado),
   * agregados tal cual a los lados `before`/`after`.
   */
  extra?: {
    before?: Record<string, unknown>;
    after?: Record<string, unknown>;
  };
}

export interface AuditScope {
  /** Saca la foto de después, arma la entrada y la publica. Nunca lanza. */
  commit(
    session: { userId: string },
    action: AuditAction,
    options?: CommitOptions,
  ): Promise<void>;
}

/** `{ Evento: "Taller" }` a partir del `subject` de la entidad y la foto disponible. */
function subjectContext(
  entityType: AuditEntityType,
  ...snapshots: (Record<string, unknown> | null)[]
): Record<string, string> {
  const subject = auditEntityDef(entityType)?.subject;
  if (!subject) return {};
  for (const snap of snapshots) {
    const v = snap?.[subject.key];
    if (typeof v === "string" && v.trim()) return { [subject.label]: v.trim() };
  }
  return {};
}

/**
 * Empieza a auditar una operación sobre `entityType`: guarda la foto de antes (si hay `id`;
 * en un alta se pasa `null`). Hay que llamarla **antes** de escribir.
 */
export async function beginAudit(
  entityType: AuditEntityType,
  id: string | null,
): Promise<AuditScope> {
  let before: Record<string, unknown> | null = null;
  try {
    before = id ? await loadSnapshot(entityType, id) : null;
  } catch (err) {
    logger.error("audit/snapshot-before", err, { entityType, id });
  }

  return {
    async commit(session, action, options = {}) {
      try {
        const def = auditEventDef(action);
        const entityId = options.entityId ?? id;
        if (!def || !entityId) {
          logger.error("audit/commit", new Error("Evento o id faltante"), {
            action,
            entityType,
          });
          return;
        }
        const after =
          def.kind === "delete"
            ? null
            : await loadSnapshot(entityType, entityId);
        const specs = auditFieldSpecs(action, entityType);
        const kind = def.kind === "custom" ? "update" : def.kind;
        const sides = pickAuditSides(kind, specs, before, after);
        const extra = options.extra;
        if (!sides && !extra) return; // Nada auditado cambió.

        const context = {
          ...subjectContext(entityType, after, before),
          ...(options.context ?? {}),
        };
        await publish(session, {
          action,
          entityType,
          entityId,
          before:
            sides?.before || extra?.before
              ? { ...(sides?.before ?? {}), ...(extra?.before ?? {}) }
              : null,
          after:
            sides?.after || extra?.after
              ? { ...(sides?.after ?? {}), ...(extra?.after ?? {}) }
              : null,
          context: Object.keys(context).length > 0 ? context : null,
          reason: options.reason ?? null,
          requestId: options.requestId ?? null,
        });
      } catch (err) {
        logger.error("audit/commit", err, { action, entityType, id });
      }
    },
  };
}

/**
 * Publica una entrada armada a mano, para los eventos `custom` (decisiones, check-in,
 * reordenamientos) donde no hay una foto de entidad que comparar.
 */
export async function emitAudit(
  session: { userId: string },
  action: AuditAction,
  input: {
    entityId: string;
    before?: Record<string, unknown> | null;
    after?: Record<string, unknown> | null;
    context?: Record<string, string> | null;
    reason?: string | null;
    requestId?: string | null;
  },
): Promise<void> {
  const def = auditEventDef(action);
  if (!def) return;
  await publish(session, {
    action,
    entityType: def.entity,
    entityId: input.entityId,
    before: input.before ?? null,
    after: input.after ?? null,
    context: input.context ?? null,
    reason: input.reason ?? null,
    requestId: input.requestId ?? null,
  });
}
