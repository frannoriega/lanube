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
