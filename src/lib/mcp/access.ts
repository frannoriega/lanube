import type { OAuthScope } from "@/lib/oauth/config";
import { hasPermission, type Permission, type PermissionSet } from "@/lib/rbac";

/**
 * Quién puede usar cada tool del conector MCP (milestones 20 y 21). Puro y testeado
 * (`access.test.ts`): es la tabla que decide qué ve y qué puede hacer un asistente.
 *
 * Una tool se habilita si se cumplen **las dos** cosas:
 *
 * - el **scope** OAuth que la persona le dio al asistente (`null` = cualquier token válido:
 *   la información pública), y
 * - **alguno** de los permisos de su rol (`null` = cualquier cuenta). Es el mismo catálogo de
 *   `src/lib/rbac.ts` que usan las rutas de la web, resuelto fresco en cada request.
 *
 * Las tools que no se habilitan **ni se registran**: el asistente no las ve en `tools/list`.
 *
 * ⚠️ Fuera del conector **por decisión del usuario** (2026-10-04): auditoría, tipos de
 * reserva, gestión de espacios, datos de contacto (su edición), roles y permisos, y temas de
 * la portada. `FORBIDDEN_PERMISSIONS` lo deja escrito y el test falla si una tool los pide.
 */

export type McpToolName =
  // Información pública — cualquier cuenta, sin scope (milestone 21).
  | "get_contact_info"
  | "list_policies"
  | "get_policy"
  | "get_about"
  // Reservas propias (milestone 20).
  | "list_spaces"
  | "get_availability"
  | "list_my_reservations"
  | "request_reservation"
  | "cancel_reservation"
  // Noticias (milestone 21): lectura y borradores. Nunca publicar ni decidir.
  | "list_news"
  | "get_news_post"
  | "create_news_draft"
  | "update_news_draft"
  // Gestión, solo lectura (milestone 21).
  | "list_events"
  | "get_event"
  | "list_event_participants"
  | "list_form_templates"
  | "get_form_template"
  | "list_profile_change_requests"
  | "get_usage_report"
  | "list_resources"
  | "get_resource";

export interface ToolAccess {
  scope: OAuthScope | null;
  anyOf: readonly Permission[] | null;
}

const NEWS_READ: Permission[] = ["news:manage", "news:approve"];

export const TOOL_ACCESS: Record<McpToolName, ToolAccess> = {
  get_contact_info: { scope: null, anyOf: null },
  list_policies: { scope: null, anyOf: null },
  get_policy: { scope: null, anyOf: null },
  get_about: { scope: null, anyOf: null },

  list_spaces: { scope: "reservations:read", anyOf: null },
  get_availability: { scope: "reservations:read", anyOf: null },
  list_my_reservations: { scope: "reservations:read", anyOf: null },
  request_reservation: { scope: "reservations:write", anyOf: null },
  cancel_reservation: { scope: "reservations:write", anyOf: null },

  list_news: { scope: "management:read", anyOf: NEWS_READ },
  get_news_post: { scope: "management:read", anyOf: NEWS_READ },
  create_news_draft: { scope: "news:write", anyOf: ["news:manage"] },
  update_news_draft: { scope: "news:write", anyOf: ["news:manage"] },

  list_events: { scope: "management:read", anyOf: ["events:manage"] },
  get_event: { scope: "management:read", anyOf: ["events:manage"] },
  list_event_participants: {
    scope: "management:read",
    anyOf: ["events:manage"],
  },
  list_form_templates: { scope: "management:read", anyOf: ["forms:manage"] },
  get_form_template: { scope: "management:read", anyOf: ["forms:manage"] },
  list_profile_change_requests: {
    scope: "management:read",
    anyOf: ["users:profile-requests:review"],
  },
  get_usage_report: { scope: "management:read", anyOf: ["reports:view"] },
  list_resources: { scope: "management:read", anyOf: ["resources:manage"] },
  get_resource: { scope: "management:read", anyOf: ["resources:manage"] },
};

/** Permisos cuyas pantallas nunca se exponen por el conector (ver el comentario de arriba). */
export const FORBIDDEN_PERMISSIONS: readonly Permission[] = [
  "audit:view",
  "reservation-types:manage",
  "spaces:manage",
  "site-config:manage",
  "roles:manage",
  "landing-themes:manage",
];

/**
 * ¿Puede esta request usar la tool? `scopes` son los del token; `permissions` el set fresco
 * de la cuenta (`null` si la cuenta está bloqueada o no se pudo resolver: entonces solo las
 * tools sin permiso requerido).
 */
export function canUseTool(
  name: McpToolName,
  scopes: readonly string[],
  permissions: PermissionSet | null,
): boolean {
  const access = TOOL_ACCESS[name];
  if (access.scope && !scopes.includes(access.scope)) return false;
  if (!access.anyOf) return true;
  if (!permissions) return false;
  return access.anyOf.some((p) => hasPermission(permissions, p));
}

/**
 * Los scopes que tiene sentido darle a un asistente según los permisos de la cuenta: a quien
 * no gestiona nada no se le piden permisos de gestión en la pantalla de consentimiento (ni se
 * guardan en su grant). Si su rol cambia después, tiene que volver a conectar el asistente.
 */
export function scopeAppliesTo(
  scope: OAuthScope,
  permissions: PermissionSet | null,
): boolean {
  const tools = (Object.keys(TOOL_ACCESS) as McpToolName[]).filter(
    (n) => TOOL_ACCESS[n].scope === scope,
  );
  return tools.some((n) => canUseTool(n, [scope], permissions));
}
