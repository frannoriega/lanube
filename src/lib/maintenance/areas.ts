/**
 * Catálogo de **áreas** de mantenimiento (milestone 22): qué se puede poner "en
 * mantenimiento" y cómo se reconoce en el servidor. Puro y seguro para el cliente (el panel y
 * los formularios lo importan).
 *
 * Una ventana (`MaintenanceWindow`) apunta a una o más áreas y tiene un **modo**:
 *
 * - `NOTICE`: solo muestra el aviso; no bloquea nada.
 * - `READ_ONLY`: se puede ver todo, pero los cambios (POST/PUT/PATCH/DELETE) responden 503.
 * - `UNAVAILABLE`: la función no funciona, ni siquiera para leer (cualquier método de sus
 *   rutas responde 503).
 *
 * Cómo se aplica (todo en un solo lugar, sin tocar cada ruta): `src/middleware.ts` mira el
 * método y la ruta de cada pedido a `/api/**` contra las ventanas vigentes. Por eso un área
 * se define por **prefijos de ruta** (`paths`). Hay una excepción: las áreas `effect:
 * "code"` no son rutas sino una conducta del servidor (ver `event-emails`).
 *
 * **Sumar un área** = una entrada acá. Nada más: el panel, la validación y el middleware la
 * leen de este catálogo.
 */

export const MAINTENANCE_MODES = [
  "NOTICE",
  "READ_ONLY",
  "UNAVAILABLE",
] as const;
export type MaintenanceMode = (typeof MAINTENANCE_MODES)[number];

export const MAINTENANCE_MODE_LABELS: Record<MaintenanceMode, string> = {
  NOTICE: "Solo aviso",
  READ_ONLY: "Solo lectura",
  UNAVAILABLE: "No disponible",
};

export const MAINTENANCE_MODE_DESCRIPTIONS: Record<MaintenanceMode, string> = {
  NOTICE: "Muestra el mensaje. No bloquea nada.",
  READ_ONLY:
    "Se puede ver todo, pero no se puede crear ni modificar nada en esas áreas.",
  UNAVAILABLE: "La función deja de andar por completo, también para consultar.",
};

/** Id del área que abarca todo el sitio. */
export const ALL_AREA = "all";

export type MaintenanceAreaDef = {
  label: string;
  description: string;
  /**
   * - `all`: todo el sitio (solo lectura global, con las excepciones de
   *   {@link READ_ONLY_EXEMPT_PREFIXES}).
   * - `paths`: se aplica a las rutas de `paths` (middleware).
   * - `code`: lo consulta el código del servidor en el punto exacto (no tiene rutas).
   */
  effect: "all" | "paths" | "code";
  /** Prefijos de ruta de la API (`/api/...`) que pertenecen al área. */
  paths: readonly string[];
};

export const MAINTENANCE_AREAS = {
  all: {
    label: "Todo el sitio",
    description:
      "Solo lectura global: nadie puede crear ni modificar nada (reservas, eventos, noticias, perfil…). Sirve para migrar o respaldar la base.",
    effect: "all",
    paths: [],
  },
  signup: {
    label: "Registro de cuentas",
    description: "Crear una cuenta nueva (envía un correo de confirmación).",
    effect: "paths",
    paths: ["/api/auth/register"],
  },
  "password-recovery": {
    label: "Recuperación de contraseña",
    description: "Pedir y usar el enlace para reestablecer la contraseña.",
    effect: "paths",
    paths: ["/api/auth/reset"],
  },
  reservations: {
    label: "Reservas",
    description: "Pedir, cancelar y gestionar reservas de espacios.",
    effect: "paths",
    paths: ["/api/resources", "/api/admin/reservations"],
  },
  events: {
    label: "Eventos e inscripciones",
    description:
      "Crear y editar eventos, e inscribirse (el formulario público).",
    effect: "paths",
    paths: ["/api/admin/events", "/api/forms"],
  },
  news: {
    label: "Noticias",
    description: "Redactar, aprobar y publicar noticias.",
    effect: "paths",
    paths: ["/api/admin/news"],
  },
  "event-emails": {
    label: "Correos de eventos a participantes",
    description:
      "Con cualquier modo distinto de «Solo aviso», no se envían los correos a participantes (inscripción, decisión, cambios de sesiones). Se omiten sin reintento; la campanita dentro de la app sigue funcionando.",
    effect: "code",
    paths: [],
  },
} as const satisfies Record<string, MaintenanceAreaDef>;

export type MaintenanceAreaId = keyof typeof MAINTENANCE_AREAS;

export const MAINTENANCE_AREA_IDS = Object.keys(
  MAINTENANCE_AREAS,
) as MaintenanceAreaId[];

export function isMaintenanceArea(value: string): value is MaintenanceAreaId {
  return Object.hasOwn(MAINTENANCE_AREAS, value);
}

/** Etiqueta de un área; cae al id crudo si ya no existe (una ventana vieja). */
export function maintenanceAreaLabel(id: string): string {
  return isMaintenanceArea(id) ? MAINTENANCE_AREAS[id].label : id;
}

/**
 * Rutas que **no** frena la solo lectura global (`all`): no son "datos" de la gente sino
 * seguridad y sesión, y bloquearlas rompería más de lo que protege.
 *
 * - NextAuth (ingreso, callback, cierre de sesión, sesión, csrf, proveedores) y el desafío
 *   del ingreso con passkey: sin esto nadie podría entrar a ver su información.
 * - `/api/oauth/token`: renovar el token del conector de asistentes.
 * - `/api/policies`: aceptar políticas (sin esto el gate no se puede cruzar). Si una
 *   aceptación hecha en plena migración se pierde, la persona la repite: es inocuo.
 * - `/api/cron`, `/api/mcp`: se protegen adentro (el cron se saltea el trabajo; las tools de
 *   escritura del conector consultan la ventana). `/api/mcp` además es siempre POST.
 * - `/api/maintenance`, `/api/admin/maintenance`: el aviso y el propio panel — si no, no se
 *   podría apagar el mantenimiento.
 * - `/api/user/notifications`: marcar como leída la campanita; perder eso no importa.
 * - `/api/session`, `/api/dev`: lecturas y utilidades de desarrollo.
 *
 * ⚠️ Es una **lista de excepciones**: una ruta nueva que escribe queda bloqueada sola. Eso
 * es a propósito (falla del lado seguro); si una ruta nueva debe seguir andando en solo
 * lectura, se agrega acá con su motivo.
 */
export const READ_ONLY_EXEMPT_PREFIXES: readonly string[] = [
  "/api/auth/callback",
  "/api/auth/signin",
  "/api/auth/signout",
  "/api/auth/session",
  "/api/auth/csrf",
  "/api/auth/providers",
  "/api/auth/error",
  "/api/auth/passkey",
  "/api/oauth/token",
  "/api/policies",
  "/api/cron",
  "/api/mcp",
  "/api/maintenance",
  "/api/admin/maintenance",
  "/api/user/notifications",
  "/api/session",
  "/api/dev",
];
