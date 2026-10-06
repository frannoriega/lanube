import type { SpaceNavItem } from "@/components/templates/management";

export interface Crumb {
  name: string;
  /** Absent on the last crumb (the current page), which renders as plain text. */
  href?: string;
}

/**
 * Label for a *static* path segment of a management route. Dynamic segments (`[id]`,
 * `[slug]`) are never keyed here — they're resolved by DYNAMIC_LABELS below, since a
 * cuid2 is not something to put in front of a person.
 */
const SEGMENT_LABELS: Record<string, string> = {
  // Admin sections (mirrors the sidebar's `navigation.admin` + `configNavigation`).
  dashboard: "Panel",
  users: "Usuarios",
  reservations: "Reservas",
  events: "Eventos",
  news: "Noticias",
  forms: "Formularios",
  reports: "Reportes",
  checkin: "Check-in",
  incidents: "Incidentes",
  spaces: "Espacios",
  resources: "Recursos",
  "reservation-types": "Tipos de reserva",
  site: "Contacto",
  themes: "Temas del landing",
  maintenance: "Mantenimiento",
  roles: "Roles y permisos",
  audit: "Auditoría",
  "profile-requests": "Cambios de datos",
  "closed-days": "Días cerrados",
  // Configuración del usuario (milestone 17): una ruta por sección.
  settings: "Configuración",
  profile: "Perfil",
  identity: "Identidad",
  security: "Seguridad",
  account: "Cuenta",
  // Leaf actions.
  new: "Nuevo",
  edit: "Editar",
  participants: "Participantes",
};

/**
 * Overrides for a section's own leaf actions, so "Nuevo"/"Editar" agree in gender with
 * the noun they belong to (Spanish) — "Nueva noticia", not "Nuevo noticia".
 */
const SECTION_LEAF_LABELS: Record<string, Record<string, string>> = {
  news: { new: "Nueva", edit: "Editar" },
  reservations: { new: "Nueva", edit: "Editar" },
};

/** The root crumb each shell hangs off — its own dashboard. */
const ROOTS = {
  admin: { name: "Panel", href: "/admin/dashboard" },
  user: { name: "Panel de control", href: "/user/dashboard" },
} as const;

/**
 * Paths that are a real URL segment but have no page of their own, so their crumb renders
 * as plain text instead of a dead link. `/user/spaces` is a grouping prefix only — the
 * user shell has just the per-space route `/user/spaces/[slug]`. `/user/settings` only
 * redirects to its first section (milestone 17), so linking it would just bounce.
 */
const NON_NAVIGABLE = new Set(["/user/spaces", "/user/settings"]);

/** A segment Next.js filled in from a dynamic route param, i.e. not a known static one. */
function isDynamic(segment: string): boolean {
  return !(segment in SEGMENT_LABELS);
}

/**
 * Breadcrumbs for a management page, derived from the pathname alone so every page in the
 * section gets navigation without opting in. The trail is always
 * `<shell dashboard> / <section> / …`, and the current page is the last, unlinked crumb.
 *
 * Returns `[]` for the dashboards themselves — there's nowhere to go up to, and a
 * one-item trail is noise.
 *
 * A dynamic segment gets a generic label ("Editar"), never the raw id; the one exception
 * is `/user/spaces/[slug]`, where `spaceNav` already carries the space's real name.
 */
export function managementCrumbs(
  pathname: string,
  userType: "user" | "admin",
  spaceNav: SpaceNavItem[] = [],
): Crumb[] {
  const root = ROOTS[userType];
  const segments = pathname.split("/").filter(Boolean);
  // Drop the shell prefix ("admin" / "user"); everything after it is the trail.
  const rest = segments.slice(1);
  if (rest.length === 0 || (rest.length === 1 && rest[0] === "dashboard")) {
    return [];
  }

  const section = rest[0];
  const crumbs: Crumb[] = [{ ...root }];
  let href = `/${segments[0]}`;

  rest.forEach((segment, i) => {
    href += `/${segment}`;
    const isLast = i === rest.length - 1;

    let name: string;
    if (isDynamic(segment)) {
      // A space's link already has its display name; anything else is an entity id, and
      // the crumb for it is the action being performed on it.
      const space = spaceNav.find((s) => s.href === href);
      name = space
        ? space.name
        : (SECTION_LEAF_LABELS[section]?.edit ?? "Editar");
    } else {
      name =
        SECTION_LEAF_LABELS[section]?.[segment] ??
        SEGMENT_LABELS[segment] ??
        segment;
    }

    // `/admin/spaces/[id]/edit` would otherwise read "… / Editar / Editar": the id crumb
    // stands in for the entity and the real action follows it, so collapse the pair.
    const linkable = !isLast && !NON_NAVIGABLE.has(href);

    const previous = crumbs[crumbs.length - 1];
    if (previous && previous.name === name) {
      crumbs[crumbs.length - 1] = linkable ? { name, href } : { name };
      return;
    }

    crumbs.push(linkable ? { name, href } : { name });
  });

  return crumbs;
}
