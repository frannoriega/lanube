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
    date: "2026-11-17",
    title: "Eventos más claros en el calendario y tabla de usuarios a medida",
    summary:
      "Los eventos del calendario de reservas se ven como eventos, con un enlace a su página. Los estados de las reservas aparecen en español. En el panel, la tabla de usuarios permite elegir qué columnas ver y explica mejor la columna de políticas.",
    file: "1.1.0.md",
  },
  {
    version: "1.2.0",
    date: "2026-11-17",
    title: "Check-in en la puerta para los eventos",
    summary:
      "Los eventos pueden usar check-in: en la puerta se busca a cada persona por su email y se registra su ingreso a la sesión. Quien llega sin haberse inscripto se puede registrar ahí mismo, y queda identificado como tal.",
    file: "1.2.0.md",
  },
  {
    version: "1.2.1",
    date: "2026-11-17",
    title: "Cada sección del panel exige su permiso",
    summary:
      "Algunas secciones del panel se podían abrir escribiendo su dirección aunque el rol no tuviera permiso para usarlas. Ahora cada sección comprueba el permiso antes de mostrarse.",
    file: "1.2.1.md",
  },
  {
    version: "1.3.0",
    date: "2026-11-17",
    title: "Los eventos llegan a los reportes",
    summary:
      "Los reportes suman una sección de eventos con sesiones, inscripciones, ocupación y asistencia del período. Cada evento tiene además su propio reporte, con un gráfico de asistencia por sesión.",
    file: "1.3.0.md",
  },
  {
    version: "1.4.0",
    date: "2026-11-17",
    title: "Calendario de actividades y reportes para descargar",
    summary:
      "Un calendario con todo lo que pasa en La Nube, por día, 3 días, semana o mes. Y los reportes se pueden descargar en Excel (con gráficos) o en CSV, eligiendo qué incluir; el reporte de cada evento también se puede imprimir.",
    file: "1.4.0.md",
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
