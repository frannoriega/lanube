/**
 * The audit trail's action vocabulary.
 *
 * Actions used to be free-text strings written at each call site, which meant a typo
 * produced a silently-unfilterable entry and the admin view had nothing to render but the
 * raw id. Keeping them here gives one place to add an action, one place to label it, and
 * a type that call sites are checked against.
 *
 * Naming: `<entity>.<verb>`, lower camel entity, dot separator. Keep existing strings
 * stable — they are persisted in `audit_logs.action` and renaming one orphans history.
 *
 * Client-safe (pure data): the admin view imports the labels.
 */
export const AUDIT_ACTIONS = {
  // Reservations
  reservationApprove: "reservation.approve",
  reservationReject: "reservation.reject",
  reservationCancel: "reservation.cancel",
  /** Written for each pending reservation `approve_reservation()` rejected as a conflict. */
  reservationAutoReject: "reservation.auto-reject",

  // Users & roles
  userRoleUpdate: "user.role.update",
  roleCreate: "role.create",
  roleUpdate: "role.update",
  roleDelete: "role.delete",

  // Superadmin catalogs
  spaceCreate: "space.create",
  spaceUpdate: "space.update",
  spaceDelete: "space.delete",
  spaceReorder: "space.reorder",
  resourceCreate: "resource.create",
  resourceUpdate: "resource.update",
  resourceDelete: "resource.delete",
  reservationTypeCreate: "reservationType.create",
  reservationTypeUpdate: "reservationType.update",
  reservationTypeDelete: "reservationType.delete",
  /** Modo "Reordenar" (milestone 14): nuevo orden de los tipos de reserva. */
  reservationTypeReorder: "reservationType.reorder",

  // Events & forms
  eventCreate: "event.create",
  eventUpdate: "event.update",
  eventDelete: "event.delete",
  /** Modo "Reordenar destacados" (milestone 14): orden de los eventos destacados del landing. */
  eventFeaturedReorder: "event.featuredReorder",
  formCreate: "form.create",
  formUpdate: "form.update",
  formDelete: "form.delete",
  participantDecide: "participant.decide",

  // Content
  newsCreate: "news.create",
  newsUpdate: "news.update",
  newsDelete: "news.delete",
  newsDecide: "news.decide",
  newsRequest: "news.request",
  newsRestore: "news.restore",
  themeCreate: "landingTheme.create",
  themeUpdate: "landingTheme.update",
  themeDelete: "landingTheme.delete",
  /** Modo "Reordenar" (milestone 14): el orden de la lista es la prioridad (arriba gana). */
  themeReorder: "landingTheme.reorder",
  /** Modo "Reordenar destacadas" (milestone 14): orden de las noticias destacadas. */
  newsFeaturedReorder: "news.featuredReorder",

  // Configuration & operations
  siteConfigUpdate: "siteConfig.update",
  checkinUpdate: "checkin.update",
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

/** Spanish labels for the admin view. Every action must have one (asserted in tests). */
export const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
  "reservation.approve": "Aprobó una reserva",
  "reservation.reject": "Rechazó una reserva",
  "reservation.cancel": "Canceló una reserva",
  "reservation.auto-reject": "Reserva rechazada automáticamente por conflicto",

  "user.role.update": "Cambió el rol de un usuario",
  "role.create": "Creó un rol",
  "role.update": "Editó un rol",
  "role.delete": "Eliminó un rol",

  "space.create": "Creó un espacio",
  "space.update": "Editó un espacio",
  "space.delete": "Eliminó un espacio",
  "space.reorder": "Reordenó los espacios",
  "resource.create": "Creó un recurso",
  "resource.update": "Editó un recurso",
  "resource.delete": "Eliminó un recurso",
  "reservationType.create": "Creó un tipo de reserva",
  "reservationType.update": "Editó un tipo de reserva",
  "reservationType.delete": "Eliminó un tipo de reserva",
  "reservationType.reorder": "Reordenó los tipos de reserva",

  "event.create": "Creó un evento",
  "event.update": "Editó un evento",
  "event.delete": "Canceló un evento",
  "event.featuredReorder": "Reordenó los eventos destacados",
  "form.create": "Creó un formulario",
  "form.update": "Editó un formulario",
  "form.delete": "Eliminó un formulario",
  "participant.decide": "Resolvió inscripciones",

  "news.create": "Creó una noticia",
  "news.update": "Editó una noticia",
  "news.delete": "Eliminó una noticia",
  "news.decide": "Aprobó o rechazó una noticia",
  "news.request": "Solicitó un cambio en una noticia publicada",
  "news.restore": "Restauró una noticia eliminada",
  "landingTheme.create": "Creó un tema de portada",
  "landingTheme.update": "Editó un tema de portada",
  "landingTheme.delete": "Eliminó un tema de portada",
  "landingTheme.reorder": "Reordenó los temas de portada (prioridad)",
  "news.featuredReorder": "Reordenó las noticias destacadas",

  "siteConfig.update": "Actualizó la configuración del sitio",
  "checkin.update": "Registró un ingreso o egreso",
};

/** Falls back to the raw action id so an entry written by older code still renders. */
export function auditActionLabel(action: string): string {
  return AUDIT_ACTION_LABELS[action as AuditAction] ?? action;
}

/**
 * Actions a person did not directly trigger — they are consequences of another entry in
 * the same request. The view de-emphasises these and groups them under their cause.
 */
export const CASCADED_ACTIONS: ReadonlySet<string> = new Set([
  AUDIT_ACTIONS.reservationAutoReject,
]);
