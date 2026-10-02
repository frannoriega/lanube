/**
 * Turns a raw audit entry (action id + before/after JSON) into text a non-technical
 * reader can follow: a subsystem tag, a short verb tag, and a one-sentence summary with
 * "campo: antes → después" instead of JSON. The raw JSON diff is still available — see
 * `src/app/(management)/admin/audit/audit-log-table.tsx`'s "Información del sistema"
 * section — this module only covers the human-readable layer on top of it.
 *
 * Pure + client-safe (no server-only imports): the admin audit table is a client
 * component so a row can open its own detail dialog without a server round-trip.
 */

/** Spanish subsystem label shown as the first tag on each row. */
const ENTITY_TYPE_LABELS: Record<string, string> = {
  Reservation: "Reservas",
  RegisteredUser: "Usuarios",
  Role: "Roles",
  Space: "Espacios",
  Resource: "Recursos",
  ReservationType: "Tipos de reserva",
  Event: "Eventos",
  Form: "Formularios",
  NewsPost: "Noticias",
  LandingTheme: "Temas de portada",
  SiteConfig: "Configuración",
  CheckIn: "Check-in",
};

export function entityTypeLabel(entityType: string): string {
  return ENTITY_TYPE_LABELS[entityType] ?? entityType;
}

/** "de/del/de la <sustantivo>" used to build the summary sentence's subject. */
const ENTITY_PHRASES: Record<string, string> = {
  Reservation: "de la reserva",
  RegisteredUser: "del usuario",
  Role: "del rol",
  Space: "del espacio",
  Resource: "del recurso",
  ReservationType: "del tipo de reserva",
  Event: "del evento",
  Form: "del formulario",
  NewsPost: "de la noticia",
  LandingTheme: "del tema de portada",
  SiteConfig: "de la configuración del sitio",
  CheckIn: "del check-in",
};

/** Short noun tag for the action, shown as the second tag on each row. */
const ACTION_VERB_TAGS: Record<string, string> = {
  "reservation.approve": "Aprobación",
  "reservation.reject": "Rechazo",
  "reservation.cancel": "Cancelación",
  "reservation.auto-reject": "Rechazo automático",
  "user.role.update": "Cambio de rol",
  "role.create": "Creación",
  "role.update": "Edición",
  "role.delete": "Eliminación",
  "space.create": "Creación",
  "space.update": "Edición",
  "space.delete": "Eliminación",
  "space.reorder": "Reordenamiento",
  "resource.create": "Creación",
  "resource.update": "Edición",
  "resource.delete": "Eliminación",
  "reservationType.create": "Creación",
  "reservationType.update": "Edición",
  "reservationType.delete": "Eliminación",
  "event.create": "Creación",
  "event.update": "Edición",
  "event.delete": "Cancelación",
  "form.create": "Creación",
  "form.update": "Edición",
  "form.delete": "Eliminación",
  "participant.decide": "Decisión",
  "news.create": "Creación",
  "news.update": "Edición",
  "news.delete": "Eliminación",
  "news.decide": "Decisión",
  "news.request": "Solicitud",
  "news.restore": "Restauración",
  "landingTheme.create": "Creación",
  "landingTheme.update": "Edición",
  "landingTheme.delete": "Eliminación",
  "siteConfig.update": "Actualización",
  "checkin.update": "Registro",
};

export function actionVerbTag(action: string): string {
  return ACTION_VERB_TAGS[action] ?? "Acción";
}

const FIELD_LABELS: Record<string, string> = {
  name: "Nombre",
  title: "Título",
  slug: "Slug",
  capacity: "Capacidad",
  isExclusive: "Exclusivo",
  isReservable: "Reservable",
  isFeatured: "Destacado",
  displayOrder: "Orden",
  iconName: "Ícono",
  imageUrl: "Imagen",
  status: "Estado",
  featuredOrder: "Orden destacado",
  serialNumber: "Número de serie",
  roleId: "Rol",
  role: "Rol",
  permissions: "Permisos",
  isSystem: "Rol de sistema",
  isSuperadmin: "Superadmin",
  checkOutTime: "Hora de salida",
  orderedIds: "Orden de espacios",
  pendingAction: "Acción pendiente",
  key: "Clave",
  description: "Descripción",
  startDate: "Fecha de inicio",
  endDate: "Fecha de fin",
  isEnabled: "Habilitado",
  priority: "Prioridad",
  summary: "Resumen",
};

function fieldLabel(key: string): string {
  return FIELD_LABELS[key] ?? key;
}

const VALUE_LABELS: Record<string, string> = {
  DRAFT: "Borrador",
  PENDING_REVIEW: "Pendiente de revisión",
  PUBLISHED: "Publicado",
  REJECTED: "Rechazado",
  PAUSED: "Pausado",
  PENDING: "Pendiente",
  APPROVED: "Aprobado",
  CANCELLED: "Cancelado",
  EDIT: "Editar",
  PAUSE: "Pausar",
  DELETE: "Eliminar",
};

function formatScalar(v: unknown): string {
  if (v === null || v === undefined || v === "") return "(vacío)";
  if (typeof v === "boolean") return v ? "Sí" : "No";
  if (typeof v === "string") return VALUE_LABELS[v] ?? v;
  if (Array.isArray(v)) {
    if (v.length === 0) return "(vacío)";
    return v.map((x) => formatScalar(x)).join(", ");
  }
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

export interface FieldChange {
  key: string;
  label: string;
  before: string;
  after: string;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

/** Only the fields that actually differ, each rendered as plain text (never JSON). */
export function buildFieldChanges(
  before: unknown,
  after: unknown,
): FieldChange[] {
  const b = asRecord(before);
  const a = asRecord(after);
  const keys = Array.from(new Set([...Object.keys(b), ...Object.keys(a)]));
  const changes: FieldChange[] = [];
  for (const key of keys) {
    const bv = b[key];
    const av = a[key];
    if (JSON.stringify(bv) === JSON.stringify(av)) continue;
    changes.push({
      key,
      label: fieldLabel(key),
      before: formatScalar(bv),
      after: formatScalar(av),
    });
  }
  return changes;
}

/** Best-effort display name for the affected record, quoted; falls back to a short id. */
export function entityDisplayLabel(
  before: unknown,
  after: unknown,
  entityId: string,
): string {
  const src = { ...asRecord(before), ...asRecord(after) };
  const name = src.name ?? src.title ?? src.key;
  if (typeof name === "string" && name.trim()) return `"${name.trim()}"`;
  return `#${entityId.slice(0, 8)}`;
}

function capitalize(s: string): string {
  return s.length ? s[0].toUpperCase() + s.slice(1) : s;
}

export interface SummarizableEntry {
  action: string;
  entityType: string;
  entityId: string;
  before: unknown;
  after: unknown;
  /** Label→value identifying info the call site recorded — see AuditLog.context. */
  context?: Record<string, string> | null;
}

/**
 * The identity half of a summary — WHICH record this entry is about. Prefers the call
 * site's recorded `context` (always present regardless of what changed); falls back to
 * sniffing a name/title/key out of before/after for entries written before that existed,
 * or for entity types that never got a context.
 */
export function entitySubject(entry: SummarizableEntry): string {
  if (entry.context && Object.keys(entry.context).length > 0) {
    return Object.values(entry.context).join(", ");
  }
  return entityDisplayLabel(entry.before, entry.after, entry.entityId);
}

/** One human sentence describing the entry — the audit table's "Resumen" column. */
export function buildChangeSummary(entry: SummarizableEntry): string {
  const phrase = ENTITY_PHRASES[entry.entityType] ?? `de ${entry.entityType}`;
  const verb = actionVerbTag(entry.action);
  const changes = buildFieldChanges(entry.before, entry.after);

  const head = `${capitalize(verb)} ${phrase}: ${entitySubject(entry)}`;
  if (changes.length === 0) return `${head}.`;

  const MAX_PREVIEW = 2;
  const preview = changes
    .slice(0, MAX_PREVIEW)
    .map((c) => `${c.label.toLowerCase()}: ${c.before} → ${c.after}`)
    .join(", ");
  const rest = changes.length - MAX_PREVIEW;
  const extra = rest > 0 ? ` y ${rest} más` : "";
  return `${head} — ${preview}${extra}.`;
}
