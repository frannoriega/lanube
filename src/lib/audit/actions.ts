/**
 * Nombres de las acciones de auditoría para usar desde el código (`AUDIT_ACTIONS.eventUpdate`).
 *
 * Desde el milestone 16 la fuente de verdad es el registro (`registry.ts`): ahí vive cada
 * evento con su entidad, sus textos y sus campos. Este archivo solo le pone un nombre en
 * camelCase a cada id y deriva de ahí las etiquetas y las acciones en cascada, para no
 * romper las llamadas existentes. El `satisfies` hace que un id que no esté registrado no
 * compile.
 *
 * Forma de los ids: `<entidad>.<verbo>`. Se persisten en `audit_logs.action`: renombrar uno
 * deja huérfano el historial.
 *
 * Seguro para el cliente (datos puros).
 */
import {
  AUDIT_EVENTS,
  auditEventDef,
  type AuditAction,
  type AuditEventDef,
} from "./registry";

export type { AuditAction };

export const AUDIT_ACTIONS = {
  // Reservas
  reservationApprove: "reservation.approve",
  reservationReject: "reservation.reject",
  reservationCancel: "reservation.cancel",
  reservationAutoReject: "reservation.auto-reject",

  // Usuarios y roles
  userRoleUpdate: "user.role.update",
  userProfileChangeDecide: "user.profileChange.decide",
  roleCreate: "role.create",
  roleUpdate: "role.update",
  roleDelete: "role.delete",

  // Catálogos de superadmin
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
  reservationTypeReorder: "reservationType.reorder",

  // Días cerrados (milestone 23)
  closedDayCreate: "closedDay.create",
  closedDayUpdate: "closedDay.update",
  closedDayDelete: "closedDay.delete",
  closedDaySync: "closedDay.sync",

  // Eventos y formularios
  eventCreate: "event.create",
  eventUpdate: "event.update",
  eventDelete: "event.delete",
  eventFeaturedReorder: "event.featuredReorder",
  formCreate: "form.create",
  formUpdate: "form.update",
  formDelete: "form.delete",
  participantDecide: "participant.decide",

  // Contenido
  newsCreate: "news.create",
  newsUpdate: "news.update",
  newsDelete: "news.delete",
  newsDecide: "news.decide",
  newsRequest: "news.request",
  newsRestore: "news.restore",
  newsFeaturedReorder: "news.featuredReorder",
  themeCreate: "landingTheme.create",
  themeUpdate: "landingTheme.update",
  themeDelete: "landingTheme.delete",
  themeReorder: "landingTheme.reorder",

  // Configuración y operación
  siteConfigUpdate: "siteConfig.update",
  maintenanceCreate: "maintenance.create",
  maintenanceUpdate: "maintenance.update",
  maintenanceEnd: "maintenance.end",
  checkinUpdate: "checkin.update",
} as const satisfies Record<string, AuditAction>;

/** Etiquetas en castellano de cada acción, derivadas del registro. */
export const AUDIT_ACTION_LABELS = Object.fromEntries(
  Object.entries(AUDIT_EVENTS).map(([id, def]) => [id, def.label]),
) as Record<AuditAction, string>;

/** Cae al id crudo, así una entrada escrita por código viejo sigue mostrándose. */
export function auditActionLabel(action: string): string {
  return auditEventDef(action)?.label ?? action;
}

/**
 * Acciones que nadie disparó directamente — son consecuencia de otra entrada del mismo
 * pedido. La vista las atenúa y las agrupa bajo su causa.
 */
export const CASCADED_ACTIONS: ReadonlySet<string> = new Set(
  Object.entries(AUDIT_EVENTS as Record<string, AuditEventDef>)
    .filter(([, def]) => def.cascaded)
    .map(([id]) => id),
);
