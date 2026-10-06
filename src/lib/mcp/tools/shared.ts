import "server-only";
import type { McpServer } from "@modelcontextprotocol/server";
import type { z } from "zod";
import { isDomainError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import type { PermissionSet } from "@/lib/rbac";
import { checkRateLimit } from "@/lib/ratelimit";
import {
  blockedMessage,
  findWriteBlockForArea,
} from "@/lib/maintenance/evaluate";
import type { MaintenanceAreaId } from "@/lib/maintenance/areas";
import { getMaintenanceSnapshotCached } from "@/lib/maintenance/server";
import type { McpTokenInfo, McpUser } from "../auth";
import { canUseTool, type McpToolName, TOOL_ACCESS } from "../access";

/**
 * Plomería común de las tools MCP (milestones 20 y 21): el contexto de la request, los
 * resultados, y `defineTool()`, que decide si una tool se registra y envuelve su handler con
 * lo común (cuenta bloqueada, rate limit, traducción de errores).
 */

/** Contexto de la request ya autenticada que necesitan las tools. */
export interface McpToolContext {
  origin: string;
  token: McpTokenInfo;
  /** `null` si la cuenta no tiene perfil completo. */
  user: McpUser | null;
  /** Permisos frescos del rol; `null` si la cuenta está bloqueada (solo tools sin permiso). */
  permissions: PermissionSet | null;
  /** Por qué la cuenta no puede operar (perfil, baneo, políticas). `null` si puede. */
  blockedMessage: string | null;
}

export type ToolResult = {
  content: { type: "text"; text: string }[];
  isError?: boolean;
};

export function ok(payload: unknown): ToolResult {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(
          payload,
          // BigInt (timestamps de Prisma) no se serializa solo.
          (_k, v) => (typeof v === "bigint" ? Number(v) : v),
          2,
        ),
      },
    ],
  };
}

export function fail(message: string): ToolResult {
  return { content: [{ type: "text", text: message }], isError: true };
}

/**
 * Límites por cuenta (por grant, en realidad: así también aplican a una cuenta bloqueada que
 * solo lee lo público). Las escrituras cuentan también los intentos fallidos: 20 por hora
 * deja margen para que el asistente se corrija solo sin bloquear a la persona.
 */
const READ_LIMIT = { maxAttempts: 60, windowMs: 60_000 };
const WRITE_LIMIT = { maxAttempts: 20, windowMs: 60 * 60 * 1000 };
/**
 * Scope de escritura → área de mantenimiento (milestone 22). `/api/mcp` es siempre POST, así
 * que el middleware no distingue lecturas de escrituras: las tools que escriben consultan la
 * ventana acá, con el mismo criterio que la web (solo lectura global o su área).
 */
const WRITE_SCOPE_AREAS: Record<string, MaintenanceAreaId> = {
  "reservations:write": "reservations",
  "news:write": "news",
};
const WRITE_SCOPES = new Set(Object.keys(WRITE_SCOPE_AREAS));

/** Configuración de una tool (lo que `McpServer.registerTool` necesita y usamos). */
export interface ToolConfig<S extends z.ZodType> {
  title: string;
  description: string;
  inputSchema?: S;
  annotations?: {
    readOnlyHint?: boolean;
    destructiveHint?: boolean;
    idempotentHint?: boolean;
    openWorldHint?: boolean;
  };
}

/**
 * El handler recibe los argumentos ya validados y la cuenta. Las tools públicas declaran solo
 * `(args)`: para ellas el segundo argumento no se usa (y puede no haber cuenta habilitada).
 */
type Handler<A> = (args: A, user: McpUser) => Promise<ToolResult>;

/**
 * Registra `name` en `server` **solo si** el token y la cuenta pueden usarla
 * (`canUseTool`, `access.ts`): una tool que no corresponde ni aparece en `tools/list`. El
 * handler:
 *
 * - si la tool necesita una cuenta habilitada (todas menos las públicas) y la cuenta está
 *   bloqueada, devuelve el motivo como error legible;
 * - aplica el rate limit (lectura o escritura según el scope);
 * - convierte un `DomainError` en `isError` con su mensaje, y cualquier otra cosa en un error
 *   genérico (logueado, sin filtrar detalles internos).
 *
 * `config` es el de `McpServer.registerTool` (título, descripción, `inputSchema`, anotaciones).
 */
export function defineTool<
  S extends z.ZodType = z.ZodObject<Record<string, never>>,
>(
  server: McpServer,
  ctx: McpToolContext,
  name: McpToolName,
  config: ToolConfig<S>,
  handler: Handler<z.infer<S>>,
): void {
  type A = z.infer<S>;
  if (!canUseTool(name, ctx.token.scopes, ctx.permissions)) return;
  const access = TOOL_ACCESS[name];
  const isPublic = access.scope === null && access.anyOf === null;

  const wrapped = async (args: A): Promise<ToolResult> => {
    if (!isPublic && (ctx.blockedMessage || !ctx.user))
      return fail(ctx.blockedMessage ?? "Cuenta no habilitada");
    const isWrite = access.scope != null && WRITE_SCOPES.has(access.scope);
    if (isWrite && access.scope) {
      // Antes del rate limit: un intento frenado por mantenimiento no gasta cupo.
      const { windows } = await getMaintenanceSnapshotCached();
      const block = findWriteBlockForArea(
        windows,
        WRITE_SCOPE_AREAS[access.scope],
      );
      if (block) return fail(blockedMessage(block));
    }
    const { allowed } = await checkRateLimit(
      `grant:${ctx.token.grantId}`,
      `/api/mcp:${isWrite ? "write" : "read"}`,
      isWrite ? WRITE_LIMIT : READ_LIMIT,
    );
    if (!allowed)
      return fail(
        isWrite
          ? "Demasiadas escrituras (reservas, cancelaciones o borradores) en la última hora. Esperá un rato antes de volver a intentar."
          : "Demasiadas consultas seguidas. Esperá un minuto y volvé a intentar.",
      );
    try {
      // En una tool pública `ctx.user` puede ser null; su handler no lo lee (ver `Handler`).
      return await handler(args, ctx.user as McpUser);
    } catch (err) {
      if (isDomainError(err)) return fail(err.message);
      logger.error(`mcp ${name}`, err);
      return fail(
        "Ocurrió un error interno en La Nube. Probá de nuevo en un rato.",
      );
    }
  };

  // El tipo de `registerTool` depende del `inputSchema` concreto; acá el wrapper es genérico.
  (server.registerTool as (...a: unknown[]) => unknown)(name, config, wrapped);
}

/** Paginación común: `page` 1-based y un tamaño acotado. */
export function pageArgs(
  page: number | undefined,
  pageSize: number | undefined,
  max = 50,
): { page: number; pageSize: number } {
  return {
    page: Math.max(1, Math.floor(page ?? 1)),
    pageSize: Math.min(max, Math.max(1, Math.floor(pageSize ?? 20))),
  };
}
