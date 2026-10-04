/**
 * Registro de políticas (milestone 19): la **única fuente de verdad** de qué políticas existen,
 * qué versiones tuvo cada una, desde cuándo rige cada versión y si hay que aceptarla.
 *
 * Por qué en código y no en la base: un texto legal tiene que pasar por revisión antes de
 * publicarse, y un PR es esa revisión (diff legible, deploy atómico con la fecha). La base solo
 * guarda las **aceptaciones** (`policy_acceptances`). La discusión completa está en
 * `docs/milestones/milestones-19-policies-and-acceptance.md`.
 *
 * Reglas (las hace cumplir `registry.test.ts`):
 *
 * - **Una versión publicada es inmutable.** Cada versión es un archivo propio bajo
 *   `src/assets/policies/<key>/<version>.mdx`, y su `sha256` está anotado acá. Editar el
 *   archivo de una versión ya publicada rompe el test. Cambiar el texto **es** agregar un
 *   archivo y una entrada nueva al final de `versions`.
 * - Las versiones van en orden cronológico (`effectiveAt` estrictamente creciente) y sus ids
 *   son únicos.
 * - Toda versión que no sea la primera trae un `changeSummary` (lo muestra la pantalla
 *   "Actualizamos nuestras políticas").
 * - Cada archivo tiene su entrada en `POLICY_CONTENT` (`components/organisms/policies/
 *   policy-content.tsx`), que es donde Next necesita el `import` estático del MDX.
 *
 * Este módulo es datos puros: se puede importar desde el cliente, el servidor y los tests.
 */

/**
 * Si una versión obliga a quienes aceptaron una anterior a volver a aceptar.
 *
 * - `required`: cambio sustancial — el gate frena a todos hasta que acepten.
 * - `not-required`: cambio editorial (una errata, un link, formato). Quien aceptó una versión
 *   anterior sigue al día; quien acepta de cero, acepta esta.
 */
export type ReacceptanceRule = "required" | "not-required";

export interface PolicyVersion {
  /**
   * Id de la versión: la fecha de publicación (`YYYY-MM-DD`, con sufijo `-2` si hubiera dos
   * el mismo día). Es lo que se guarda en `policy_acceptances.version` y lo que va en la URL
   * de la versión archivada, así que **nunca se renombra**.
   */
  version: string;
  /**
   * Desde cuándo rige, como fecha calendario (`YYYY-MM-DD`) en la zona horaria del predio:
   * rige desde las 00:00 de ese día en Concepción del Uruguay. Permite desplegar una versión
   * antes de que entre en vigencia.
   */
  effectiveAt: string;
  /** Ruta del MDX relativa a `src/assets/policies/`. */
  file: string;
  /** SHA-256 (hex) del archivo. Se guarda con cada aceptación como prueba del texto exacto. */
  sha256: string;
  /** Si esta versión exige aceptación expresa (checkbox en el alta y gate). */
  requiresAcceptance: boolean;
  /** Ver `ReacceptanceRule`. Irrelevante si `requiresAcceptance` es `false`. */
  reacceptance: ReacceptanceRule;
  /** Qué cambió respecto de la versión anterior, en castellano llano. `null` solo en la primera. */
  changeSummary: string[] | null;
}

export interface PolicyDefinition {
  /** Segmento de la URL pública: `/policies/<slug>`. */
  slug: string;
  /** Título visible ("Política de privacidad"). */
  title: string;
  /** Una línea que explica de qué trata (se ve en el índice `/policies`). */
  description: string;
  /** Versiones en orden cronológico; la última vigente es la que rige. */
  versions: readonly PolicyVersion[];
}

export const POLICIES = {
  privacy: {
    slug: "privacy",
    title: "Política de privacidad",
    description:
      "Qué datos personales recolecta La Nube, para qué los usa y cuáles son tus derechos.",
    versions: [
      {
        version: "2025-11-16",
        effectiveAt: "2025-11-16",
        file: "privacy/2025-11-16.mdx",
        sha256:
          "aee66b848896b372c12569d132b952b654dffa18e89f3012ac29663e149550a3",
        requiresAcceptance: true,
        reacceptance: "required",
        changeSummary: null,
      },
    ],
  },
} as const satisfies Record<string, PolicyDefinition>;

/** Clave estable de una política (`"privacy"`). Se guarda en `policy_acceptances.policy_key`. */
export type PolicyKey = keyof typeof POLICIES;

/** Todas las claves, en el orden en que se muestran. */
export const POLICY_KEYS = Object.keys(POLICIES) as PolicyKey[];

/** Definición de una política por clave, tipada como `PolicyDefinition` (sin el `as const`). */
export function getPolicy(key: PolicyKey): PolicyDefinition {
  return POLICIES[key];
}

/** Política por su slug de URL, o `null`. */
export function getPolicyBySlug(
  slug: string,
): { key: PolicyKey; policy: PolicyDefinition } | null {
  const key = POLICY_KEYS.find((k) => POLICIES[k].slug === slug);
  return key ? { key, policy: POLICIES[key] } : null;
}

/** Si una cadena es una clave de política conocida (para validar entrada de la API). */
export function isPolicyKey(value: unknown): value is PolicyKey {
  return typeof value === "string" && value in POLICIES;
}
