/**
 * Registro de novedades (milestone 28): la **única fuente de verdad** de qué versiones de La
 * Nube existen, y por lo tanto de cuál es la versión que corre. La versión actual es la última
 * entrada de `RELEASES`; el servidor la muestra en el pie del sitio, la devuelve
 * `GET /api/version` y la informa el conector MCP.
 *
 * Mismo esquema que las políticas (milestone 19): los datos (versión, fecha, título, resumen)
 * en código, y el texto largo de cada versión en un archivo propio,
 * `src/assets/changelog/<version>.md` (markdown común, lo dibuja `Markdown`).
 *
 * Versionado semántico (`MAJOR.MINOR.PATCH`), con este significado para una app web:
 *
 * - **MAJOR**: algo que obliga a alguien a cambiar lo que hace — se quita una función o una
 *   URL sin redirección, cambia de forma incompatible el contrato del conector MCP o de la API
 *   pública, o hay que volver a aceptar políticas/volver a configurar algo.
 * - **MINOR**: algo nuevo que se puede usar (una pantalla, una herramienta, una opción).
 * - **PATCH**: arreglos y cambios internos sin función nueva (rendimiento, seguridad, textos).
 *
 * Reglas (las hace cumplir `registry.test.ts`, y la de "no hay cambio sin versión"
 * `scripts/check-release.ts` en CI):
 *
 * - Toda entrada es semver válido y cada una es el **siguiente** salto de la anterior
 *   (sin saltear versiones).
 * - Las fechas no retroceden.
 * - `package.json` dice la misma versión que la última entrada.
 * - Cada entrada tiene su archivo `.md` no vacío.
 * - Un cambio en lo que se despliega sin entrada nueva frena el deploy (ver el script).
 *
 * Este módulo es datos puros: se puede importar desde el cliente, el servidor y los tests.
 */

export interface Release {
  /** `MAJOR.MINOR.PATCH`. Es la URL de su página (`/changelog/<version>`): nunca se renombra. */
  version: string;
  /** Fecha de publicación, `YYYY-MM-DD` (fecha calendario, sin hora). */
  date: string;
  /** Título corto, lo que se ve en el listado ("Lanzamiento oficial"). */
  title: string;
  /** Una o dos oraciones para el listado: qué trae, en castellano llano. */
  summary: string;
  /** Ruta del markdown relativa a `src/assets/changelog/`. */
  file: string;
}

/** Todas las versiones, en orden (la más vieja primero). Agregar una es sumar al final. */
export const RELEASES = [
  {
    version: "1.0.0",
    date: "2026-11-16",
    title: "Lanzamiento oficial",
    summary:
      "La primera versión estable de La Nube: reservas de espacios, eventos con inscripción, noticias, panel de gestión, políticas versionadas y conector para asistentes de IA.",
    file: "1.0.0.md",
  },
  {
    version: "1.0.1",
    date: "2026-11-16",
    title: "Reservas de hoy y botón de ingreso más claros",
    summary:
      "Al reservar para hoy, el formulario ya no propone la hora de apertura si ya pasó: empieza en el primer turno que se puede reservar. Y el botón de ingreso del inicio muestra un indicador de carga mientras se resuelve la sesión.",
    file: "1.0.1.md",
  },
  {
    version: "1.0.2",
    date: "2026-11-17",
    title: "La confirmación del email vuelve a funcionar",
    summary:
      "Al abrir el enlace de confirmación del email, el sitio redirigía a una dirección inválida y el navegador mostraba un error de conexión. Ahora vuelve a la pantalla de ingreso de La Nube.",
    file: "1.0.2.md",
  },
  {
    version: "1.1.0",
    date: "2026-11-18",
    title:
      "Check-in en eventos, calendario de actividades, reportes descargables y reservas con título",
    summary:
      "Los eventos tienen check-in en la puerta y llegan a los reportes, que se descargan en Excel o CSV. Hay un calendario con todo lo que pasa en La Nube, y cada reserva ahora tiene título. Además, los eventos se ven como eventos en el calendario de reservas, y cada sección del panel exige su permiso.",
    file: "1.1.0.md",
  },
  {
    version: "1.1.1",
    date: "2026-11-19",
    title: "El calendario de reservas muestra el día completo",
    summary:
      "El calendario de cada espacio ahora llega hasta la medianoche, así los eventos que terminan tarde ya no se ven cortados; después de las 19:00 el horario se ve rayado como no disponible. Y los eventos pueden terminar a las 00:00.",
    file: "1.1.1.md",
  },
  {
    version: "1.2.0",
    date: "2026-11-25",
    title:
      "Eventos privados, equipos con check-in por persona y tu calendario en Google",
    summary:
      "Los eventos pueden ser privados, con lista de invitados. Los formularios inscriben equipos y la puerta registra el ingreso de cada integrante. Tus reservas y eventos se suman a Google Calendar, Apple u Outlook. Cada sesión que se cancela o reprograma lleva su motivo, las notificaciones se pueden borrar, y al compartir una noticia o un evento se ve su imagen.",
    file: "1.2.0.md",
  },
] as const satisfies readonly Release[];

/** La versión que corre: la última del registro. */
export const CURRENT_RELEASE: Release = RELEASES[RELEASES.length - 1];

/** Atajo: `"1.0.0"`. */
export const APP_VERSION: string = CURRENT_RELEASE.version;

/** Una versión por su número, o `null`. */
export function getRelease(version: string): Release | null {
  return RELEASES.find((r) => r.version === version) ?? null;
}

/** La más nueva primero, como se muestran. */
export function releasesNewestFirst(): Release[] {
  return [...RELEASES].reverse();
}

/** La versión anterior y la siguiente de una dada (para navegar entre páginas). */
export function adjacentReleases(version: string): {
  older: Release | null;
  newer: Release | null;
} {
  const i = RELEASES.findIndex((r) => r.version === version);
  if (i < 0) return { older: null, newer: null };
  return {
    older: i > 0 ? RELEASES[i - 1] : null,
    newer: i < RELEASES.length - 1 ? RELEASES[i + 1] : null,
  };
}
