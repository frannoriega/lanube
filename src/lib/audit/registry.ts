/**
 * Registro de eventos de auditoría (milestone 16): **el único lugar** que hay que tocar para
 * que una funcionalidad nueva quede auditada y se lea bien en `/admin/audit`.
 *
 * Antes el vocabulario estaba repartido en cuatro mapas (`AUDIT_ACTIONS`, sus etiquetas,
 * los "verbos" y las frases de entidad de `humanize.ts`, más un `FIELD_LABELS` global), y
 * cada ruta elegía a mano qué campos guardar — por eso "Editó un evento" solo guardaba el
 * nombre y el estado, y la entrada no decía qué había cambiado. Ahora:
 *
 * - **Entidades** (`AUDIT_ENTITIES`): cómo se llama el subsistema ("Eventos"), cómo se lo
 *   nombra en una oración ("del evento"), qué campo identifica al registro (`subject`) y, sobre
 *   todo, **qué campos se auditan y de qué tipo es cada uno** (`fields`, ver `fields.ts`). Un
 *   campo que no figura acá no se guarda: así un `updatedAt` o un id interno nunca aparecen
 *   como "cambio".
 * - **Eventos** (`AUDIT_EVENTS`): cada acción auditable (`"event.update"`), con su entidad,
 *   su frase completa ("Editó un evento"), la etiqueta corta del chip ("Edición") y su
 *   `kind` — que le dice a `beginAudit` qué fotos guardar (alta: solo después; baja: solo
 *   antes; edición: solo lo que cambió).
 *
 * **Agregar algo nuevo**: (1) si es una entidad nueva, declararla en `AUDIT_ENTITIES` y su
 * foto en `snapshots.ts`; (2) declarar el evento acá y su nombre en `AUDIT_ACTIONS`
 * (`actions.ts`); (3) en la ruta, `beginAudit(...)` antes de escribir y `.commit(...)`
 * después. Los tests de `registry.test.ts` fallan si falta alguna pieza.
 *
 * Los ids de evento se **persisten** en `audit_logs.action`: renombrar uno deja huérfano el
 * historial. Puro y seguro para el cliente (el panel de auditoría lo importa).
 */

import {
  CLOSED_DAY_SOURCE_LABELS,
  CLOSED_DAY_STATUS_LABELS,
} from "@/lib/constants/closed-days";
import { EVENT_STATUS_LABELS } from "@/lib/constants/events";
import { SPACE_KIND_LABELS } from "@/lib/constants/spaces";
import { FIELD_TYPE_LABELS } from "@/lib/constants/form-fields";
import {
  MAINTENANCE_AREAS,
  MAINTENANCE_MODE_LABELS,
  type MaintenanceAreaId,
} from "@/lib/maintenance/areas";
import { PERMISSION_LABELS } from "@/lib/rbac";
import {
  bool,
  date,
  dateTime,
  enumOf,
  image,
  itemsOf,
  longText,
  monthDay,
  num,
  order,
  setOf,
  text,
  type FieldSpecs,
} from "./fields";

// ---------------------------------------------------------------------------
// Valores de enums del sistema, traducidos
// ---------------------------------------------------------------------------

const NEWS_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Borrador",
  PENDING_REVIEW: "Pendiente de revisión",
  PUBLISHED: "Publicada",
  REJECTED: "Rechazada",
  PAUSED: "Pausada",
};

const NEWS_PENDING_ACTION_LABELS: Record<string, string> = {
  EDIT: "Editar",
  PAUSE: "Pausar",
  DELETE: "Eliminar",
};

const REQUEST_STATUS_LABELS: Record<string, string> = {
  PENDING: "Pendiente",
  APPROVED: "Aprobado",
  REJECTED: "Rechazado",
  CANCELLED: "Cancelado",
};

const THEME_EFFECT_LABELS: Record<string, string> = {
  NONE: "Ninguno",
  EMOJI_SHOWER: "Lluvia de emojis",
};

const KEYWORD_MODE_LABELS: Record<string, string> = {
  APPEND: "Sumar a las de siempre",
  REPLACE: "Reemplazar las de siempre",
};

const DECISION_LABELS: Record<string, string> = {
  approve: "Aprobar",
  reject: "Rechazar",
};

const PROFILE_CHANGE_FIELD_LABELS: Record<string, string> = {
  DNI: "DNI",
  REASON_TO_JOIN: "Motivo para unirse",
};

// ---------------------------------------------------------------------------
// Entidades
// ---------------------------------------------------------------------------

export interface AuditEntityDef {
  /** Chip del subsistema en la tabla ("Eventos"). */
  label: string;
  /** "de/del/de la <sustantivo>", para el resumen ("Edición del evento: …"). */
  phrase: string;
  /**
   * Campo de la foto que nombra al registro, y su rótulo — se guarda como `context` en cada
   * entrada (`{ Evento: "Taller de robótica" }`), así la tabla siempre dice **cuál** registro
   * fue, aunque el cambio no haya tocado el nombre.
   */
  subject?: { key: string; label: string };
  /** Campos auditados y su tipo. Lo que no está acá no se guarda ni se muestra. */
  fields: FieldSpecs;
}

export const AUDIT_ENTITIES = {
  Reservation: {
    label: "Reservas",
    phrase: "de la reserva",
    fields: { status: enumOf("Estado", REQUEST_STATUS_LABELS) },
  },
  RegisteredUser: {
    label: "Usuarios",
    phrase: "del usuario",
    fields: { role: text("Rol") },
  },
  Role: {
    label: "Roles",
    phrase: "del rol",
    subject: { key: "name", label: "Rol" },
    fields: {
      name: text("Nombre"),
      key: text("Clave"),
      description: longText("Descripción"),
      permissions: setOf("Permisos", PERMISSION_LABELS),
      grantableRoles: setOf("Roles que puede asignar"),
      isSystem: bool("Rol de sistema"),
      isSuperadmin: bool("Superadmin"),
    },
  },
  Space: {
    label: "Espacios",
    phrase: "del espacio",
    subject: { key: "name", label: "Espacio" },
    fields: {
      kind: enumOf("Tipo", SPACE_KIND_LABELS),
      name: text("Nombre"),
      slug: text("Dirección (slug)"),
      description: longText("Descripción breve"),
      longDescription: longText("Descripción"),
      faqs: itemsOf("Preguntas frecuentes", "question", {
        question: text("Pregunta"),
        answer: longText("Respuesta"),
      }),
      imageUrl: image("Imagen"),
      iconName: text("Ícono"),
      capacity: num("Capacidad", "personas"), // null = sin capacidad (áreas comunes)
      isExclusive: bool("Uso exclusivo"),
      isReservable: bool("Reservable"),
      isFeatured: bool("Destacado"),
      order: order("Orden"),
    },
  },
  Resource: {
    label: "Recursos",
    phrase: "del recurso",
    subject: { key: "name", label: "Recurso" },
    fields: {
      name: text("Nombre"),
      serialNumber: text("Número de serie"),
    },
  },
  ReservationType: {
    label: "Tipos de reserva",
    phrase: "del tipo de reserva",
    subject: { key: "name", label: "Tipo de reserva" },
    fields: {
      name: text("Nombre"),
      code: text("Código"),
      order: order("Orden"),
    },
  },
  ClosedDay: {
    label: "Días cerrados",
    phrase: "del día cerrado",
    subject: { key: "title", label: "Día cerrado" },
    fields: {
      title: text("Motivo"),
      // Texto ya formateado (dd/mm/aaaa) en el snapshot: son fechas de calendario locales y el
      // tipo `date` las correría de día al interpretarlas como instantes.
      startDate: text("Desde"),
      endDate: text("Hasta"),
      window: text("Horario"),
      source: enumOf("Origen", CLOSED_DAY_SOURCE_LABELS),
      status: enumOf("Estado", CLOSED_DAY_STATUS_LABELS),
    },
  },
  Event: {
    label: "Eventos",
    phrase: "del evento",
    subject: { key: "name", label: "Evento" },
    fields: {
      name: text("Nombre"),
      status: enumOf("Estado", EVENT_STATUS_LABELS),
      eventType: text("Tipo"),
      space: text("Espacio"),
      location: text("Ubicación"),
      startDate: date("Desde"),
      endDate: date("Hasta"),
      weekdays: setOf("Días"),
      schedule: text("Horario"),
      capacity: num("Cupo", "personas"),
      requiresApproval: bool("Requiere aprobación"),
      isFeatured: bool("Destacado"),
      summary: longText("Resumen"),
      description: longText("Descripción"),
      imageUrl: image("Imagen"),
      formTemplate: text("Formulario"),
      registrationOpensAt: dateTime("Abre la inscripción"),
      registrationClosesAt: dateTime("Cierra la inscripción"),
      /** No sale de la foto: lo agrega la ruta al guardar (ver `describeSessionActions`). */
      sessions: setOf("Sesiones modificadas"),
      order: order("Orden de destacados"),
    },
  },
  Form: {
    label: "Formularios",
    phrase: "del formulario",
    subject: { key: "name", label: "Formulario" },
    fields: {
      name: text("Nombre"),
      description: longText("Descripción"),
      fields: itemsOf("Preguntas", "label", {
        label: text("Pregunta"),
        section: text("Sección"),
        type: enumOf("Tipo", FIELD_TYPE_LABELS),
        required: bool("Obligatoria"),
        options: setOf("Opciones"),
      }),
    },
  },
  NewsPost: {
    label: "Noticias",
    phrase: "de la noticia",
    subject: { key: "title", label: "Noticia" },
    fields: {
      title: text("Título"),
      slug: text("Dirección (slug)"),
      status: enumOf("Estado", NEWS_STATUS_LABELS),
      pendingAction: enumOf("Acción pendiente", NEWS_PENDING_ACTION_LABELS),
      isFeatured: bool("Destacada"),
      summary: longText("Bajada"),
      body: longText("Cuerpo"),
      coverImageUrl: image("Portada"),
      decisionReason: longText("Motivo de la decisión"),
      // Un pedido de cambio sobre una nota publicada (ver `requestNewsPostAction`).
      pendingReason: longText("Motivo del pedido"),
      pendingTitle: text("Título propuesto"),
      pendingSummary: longText("Bajada propuesta"),
      pendingBody: longText("Cuerpo propuesto"),
      pendingCoverImageUrl: image("Portada propuesta"),
      order: order("Orden de destacadas"),
    },
  },
  LandingTheme: {
    label: "Temas de portada",
    phrase: "del tema de portada",
    subject: { key: "name", label: "Tema" },
    fields: {
      name: text("Nombre"),
      isEnabled: bool("Habilitado"),
      recurring: bool("Se repite cada año"),
      startMonthDay: monthDay("Desde"),
      endMonthDay: monthDay("Hasta"),
      startDate: date("Desde"),
      endDate: date("Hasta"),
      entranceEffect: enumOf("Efecto de entrada", THEME_EFFECT_LABELS),
      emojiList: text("Emojis"),
      particleCount: num("Cantidad de partículas"),
      heroEyebrowOverride: text("Línea superior del inicio"),
      heroKeywords: text("Palabras rotativas"),
      heroKeywordsMode: enumOf("Uso de las palabras", KEYWORD_MODE_LABELS),
      order: order("Prioridad (arriba gana)"),
    },
  },
  SiteConfig: {
    label: "Configuración",
    phrase: "de la configuración del sitio",
    fields: {
      addressText: text("Dirección"),
      addressUrl: text("Enlace de la dirección"),
      email: text("Correo"),
      phoneText: text("Teléfono"),
      phoneClickable: text("Teléfono (para marcar)"),
      instagramUrl: text("Enlace de Instagram"),
      instagramText: text("Usuario de Instagram"),
      githubUrl: text("Enlace de GitHub"),
      githubText: text("Usuario de GitHub"),
    },
  },
  MaintenanceWindow: {
    label: "Mantenimiento",
    phrase: "del mantenimiento",
    subject: { key: "title", label: "Mantenimiento" },
    fields: {
      title: text("Título"),
      reasonMd: longText("Motivo"),
      mode: enumOf("Modo", MAINTENANCE_MODE_LABELS),
      areas: setOf(
        "Áreas",
        Object.fromEntries(
          (Object.keys(MAINTENANCE_AREAS) as MaintenanceAreaId[]).map((id) => [
            id,
            MAINTENANCE_AREAS[id].label,
          ]),
        ),
      ),
      startsAt: dateTime("Desde"),
      endsAt: dateTime("Hasta"),
      endedAt: dateTime("Finalizado"),
    },
  },
  CheckIn: {
    label: "Check-in",
    phrase: "del check-in",
    fields: { checkOutTime: dateTime("Hora de salida") },
  },
} satisfies Record<string, AuditEntityDef>;

export type AuditEntityType = keyof typeof AUDIT_ENTITIES;

// ---------------------------------------------------------------------------
// Eventos
// ---------------------------------------------------------------------------

/**
 * Qué fotos guarda `beginAudit(...).commit(...)`:
 * - `create`: solo "después", sin los campos vacíos.
 * - `update`: solo los campos que cambiaron, de los dos lados; si nada cambió, no escribe.
 * - `delete`: solo "antes", sin los campos vacíos.
 * - `custom`: la ruta arma `before`/`after` a mano (decisiones, check-in, reordenamientos).
 */
export type AuditEventKind = "create" | "update" | "delete" | "custom";

export interface AuditEventDef {
  entity: AuditEntityType;
  kind: AuditEventKind;
  /** Oración completa en pasado: "Editó un evento". */
  label: string;
  /** Chip corto de la tabla: "Edición". */
  verb: string;
  /** Efecto de otra entrada del mismo pedido (la vista lo atenúa y agrupa). */
  cascaded?: boolean;
  /** Campos propios del evento, además de los de la entidad (p. ej. una decisión). */
  fields?: FieldSpecs;
}

export const AUDIT_EVENTS = {
  // Reservas
  "reservation.approve": {
    entity: "Reservation",
    kind: "custom",
    label: "Aprobó una reserva",
    verb: "Aprobación",
  },
  "reservation.reject": {
    entity: "Reservation",
    kind: "custom",
    label: "Rechazó una reserva",
    verb: "Rechazo",
  },
  "reservation.cancel": {
    entity: "Reservation",
    kind: "custom",
    label: "Canceló una reserva",
    verb: "Cancelación",
  },
  /** Una por cada pendiente que `approve_reservation()` rechazó por conflicto. */
  "reservation.auto-reject": {
    entity: "Reservation",
    kind: "custom",
    label: "Reserva rechazada automáticamente por conflicto",
    verb: "Rechazo automático",
    cascaded: true,
  },

  // Usuarios y roles
  "user.role.update": {
    entity: "RegisteredUser",
    kind: "custom",
    label: "Cambió el rol de un usuario",
    verb: "Cambio de rol",
  },
  /**
   * Un admin resolvió una solicitud de cambio de DNI / motivo (milestone 17). Al aprobar,
   * `before`/`after` llevan el valor real del campo (así el diff muestra el cambio); al
   * rechazar, el perfil no cambió y solo se guarda qué se pidió.
   */
  "user.profileChange.decide": {
    entity: "RegisteredUser",
    kind: "custom",
    label: "Resolvió una solicitud de cambio de datos",
    verb: "Cambio de datos",
    fields: {
      decision: enumOf("Decisión", DECISION_LABELS),
      field: enumOf("Dato", PROFILE_CHANGE_FIELD_LABELS),
      dni: text("DNI"),
      reasonToJoin: longText("Motivo para unirse"),
      requestedValue: longText("Valor pedido"),
    },
  },
  "role.create": {
    entity: "Role",
    kind: "create",
    label: "Creó un rol",
    verb: "Creación",
  },
  "role.update": {
    entity: "Role",
    kind: "update",
    label: "Editó un rol",
    verb: "Edición",
  },
  "role.delete": {
    entity: "Role",
    kind: "delete",
    label: "Eliminó un rol",
    verb: "Eliminación",
  },

  // Catálogos de superadmin
  "space.create": {
    entity: "Space",
    kind: "create",
    label: "Creó un espacio",
    verb: "Creación",
  },
  "space.update": {
    entity: "Space",
    kind: "update",
    label: "Editó un espacio",
    verb: "Edición",
  },
  "space.delete": {
    entity: "Space",
    kind: "delete",
    label: "Eliminó un espacio",
    verb: "Eliminación",
  },
  "space.reorder": {
    entity: "Space",
    kind: "custom",
    label: "Reordenó los espacios",
    verb: "Reordenamiento",
  },
  "resource.create": {
    entity: "Resource",
    kind: "create",
    label: "Creó un recurso",
    verb: "Creación",
  },
  "resource.update": {
    entity: "Resource",
    kind: "update",
    label: "Editó un recurso",
    verb: "Edición",
  },
  "resource.delete": {
    entity: "Resource",
    kind: "delete",
    label: "Eliminó un recurso",
    verb: "Eliminación",
  },
  "reservationType.create": {
    entity: "ReservationType",
    kind: "create",
    label: "Creó un tipo de reserva",
    verb: "Creación",
  },
  "reservationType.update": {
    entity: "ReservationType",
    kind: "update",
    label: "Editó un tipo de reserva",
    verb: "Edición",
  },
  "reservationType.delete": {
    entity: "ReservationType",
    kind: "delete",
    label: "Eliminó un tipo de reserva",
    verb: "Eliminación",
  },
  "reservationType.reorder": {
    entity: "ReservationType",
    kind: "custom",
    label: "Reordenó los tipos de reserva",
    verb: "Reordenamiento",
  },

  // Días cerrados
  "closedDay.create": {
    entity: "ClosedDay",
    kind: "create",
    label: "Cargó un día cerrado",
    verb: "Creación",
  },
  "closedDay.update": {
    entity: "ClosedDay",
    kind: "update",
    label: "Editó un día cerrado",
    verb: "Edición",
  },
  "closedDay.delete": {
    entity: "ClosedDay",
    kind: "delete",
    label: "Eliminó un día cerrado",
    verb: "Eliminación",
  },
  /** Una sola entrada por sincronización (no por feriado): el resumen va en `after`. */
  "closedDay.sync": {
    entity: "ClosedDay",
    kind: "custom",
    label: "Sincronizó los feriados nacionales",
    verb: "Sincronización",
    fields: {
      created: num("Feriados propuestos"),
      refreshed: num("Propuestas actualizadas"),
      missing: num("Cargados que el origen ya no trae"),
      failedYears: text("Años que no se pudieron traer"),
    },
  },

  // Eventos y formularios
  "event.create": {
    entity: "Event",
    kind: "create",
    label: "Creó un evento",
    verb: "Creación",
  },
  "event.update": {
    entity: "Event",
    kind: "update",
    label: "Editó un evento",
    verb: "Edición",
  },
  /** Baja lógica: el evento queda como "Cancelado" (ver `deleteEvent`). */
  "event.delete": {
    entity: "Event",
    kind: "delete",
    label: "Canceló un evento",
    verb: "Cancelación",
  },
  "event.featuredReorder": {
    entity: "Event",
    kind: "custom",
    label: "Reordenó los eventos destacados",
    verb: "Reordenamiento",
  },
  "form.create": {
    entity: "Form",
    kind: "create",
    label: "Creó un formulario",
    verb: "Creación",
  },
  "form.update": {
    entity: "Form",
    kind: "update",
    label: "Editó un formulario",
    verb: "Edición",
  },
  "form.delete": {
    entity: "Form",
    kind: "delete",
    label: "Eliminó un formulario",
    verb: "Eliminación",
  },
  /** Se audita sobre el evento (las inscripciones no tienen entidad propia en la vista). */
  "participant.decide": {
    entity: "Event",
    kind: "custom",
    label: "Resolvió inscripciones",
    verb: "Decisión",
    fields: {
      decision: enumOf("Decisión", DECISION_LABELS),
      decided: num("Personas alcanzadas"),
      reason: longText("Motivo"),
    },
  },

  // Contenido
  "news.create": {
    entity: "NewsPost",
    kind: "create",
    label: "Creó una noticia",
    verb: "Creación",
  },
  "news.update": {
    entity: "NewsPost",
    kind: "update",
    label: "Editó una noticia",
    verb: "Edición",
  },
  "news.delete": {
    entity: "NewsPost",
    kind: "delete",
    label: "Eliminó una noticia",
    verb: "Eliminación",
  },
  "news.decide": {
    entity: "NewsPost",
    kind: "update",
    label: "Aprobó o rechazó una noticia",
    verb: "Decisión",
  },
  "news.request": {
    entity: "NewsPost",
    kind: "update",
    label: "Solicitó un cambio en una noticia publicada",
    verb: "Solicitud",
  },
  "news.restore": {
    entity: "NewsPost",
    kind: "create",
    label: "Restauró una noticia eliminada",
    verb: "Restauración",
  },
  "news.featuredReorder": {
    entity: "NewsPost",
    kind: "custom",
    label: "Reordenó las noticias destacadas",
    verb: "Reordenamiento",
  },
  "landingTheme.create": {
    entity: "LandingTheme",
    kind: "create",
    label: "Creó un tema de portada",
    verb: "Creación",
  },
  "landingTheme.update": {
    entity: "LandingTheme",
    kind: "update",
    label: "Editó un tema de portada",
    verb: "Edición",
  },
  "landingTheme.delete": {
    entity: "LandingTheme",
    kind: "delete",
    label: "Eliminó un tema de portada",
    verb: "Eliminación",
  },
  "landingTheme.reorder": {
    entity: "LandingTheme",
    kind: "custom",
    label: "Reordenó los temas de portada (prioridad)",
    verb: "Reordenamiento",
  },

  // Configuración y operación
  "siteConfig.update": {
    entity: "SiteConfig",
    kind: "update",
    label: "Actualizó la configuración del sitio",
    verb: "Actualización",
  },
  "maintenance.create": {
    entity: "MaintenanceWindow",
    kind: "create",
    label: "Declaró un mantenimiento",
    verb: "Alta",
  },
  "maintenance.update": {
    entity: "MaintenanceWindow",
    kind: "update",
    label: "Editó un mantenimiento",
    verb: "Edición",
  },
  "maintenance.end": {
    entity: "MaintenanceWindow",
    kind: "update",
    label: "Finalizó un mantenimiento",
    verb: "Fin",
  },
  "checkin.update": {
    entity: "CheckIn",
    kind: "custom",
    label: "Registró un ingreso o egreso",
    verb: "Registro",
  },
} satisfies Record<string, AuditEventDef>;

export type AuditAction = keyof typeof AUDIT_EVENTS;

/** Definición de un evento, o `undefined` para ids que ya no existen (entradas viejas). */
export function auditEventDef(action: string): AuditEventDef | undefined {
  return (AUDIT_EVENTS as Record<string, AuditEventDef>)[action];
}

/** Definición de una entidad, o `undefined` para tipos desconocidos. */
export function auditEntityDef(entityType: string): AuditEntityDef | undefined {
  return (AUDIT_ENTITIES as Record<string, AuditEntityDef>)[entityType];
}

/**
 * Campos de una entrada: los de su entidad más los propios del evento. Si el evento ya no
 * existe se usa la entidad de la entrada, así una entrada vieja sigue leyéndose bien.
 */
export function auditFieldSpecs(
  action: string,
  entityType: string,
): FieldSpecs {
  const event = auditEventDef(action);
  const entity = auditEntityDef(event?.entity ?? entityType);
  return { ...(entity?.fields ?? {}), ...(event?.fields ?? {}) };
}
