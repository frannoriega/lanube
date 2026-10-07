/**
 * Serialización para la caché de datos de Next (milestone 25, P2).
 *
 * `unstable_cache` guarda el resultado con `JSON.stringify`, que **revienta con BigInt** (todas
 * las marcas de tiempo de la base son BigInt en ms) y convierte un `Date` en string sin volver.
 * Estas dos funciones etiquetan esos dos tipos al guardar y los reconstruyen al leer, así una
 * fila de Prisma sale de la caché con los mismos tipos con los que entró. Puras, con test.
 */

type Tagged = { __cache: "bigint" | "date"; v: string };

function isTagged(value: unknown): value is Tagged {
  return (
    typeof value === "object" &&
    value !== null &&
    "__cache" in value &&
    "v" in value &&
    Object.keys(value).length === 2
  );
}

/** A string, conservando BigInt y Date. */
export function serializeForCache(value: unknown): string {
  return JSON.stringify(value, function (this: unknown, key: string, v) {
    // `this[key]` es el valor original: para un Date, `v` ya pasó por `toJSON()`.
    const raw = (this as Record<string, unknown>)[key];
    if (typeof raw === "bigint")
      return { __cache: "bigint", v: raw.toString() };
    if (raw instanceof Date) return { __cache: "date", v: raw.toISOString() };
    return v;
  });
}

/** Inversa de {@link serializeForCache}. */
export function deserializeFromCache<T>(text: string): T {
  return JSON.parse(text, (_key, v) => {
    if (!isTagged(v)) return v;
    return v.__cache === "bigint" ? BigInt(v.v) : new Date(v.v);
  }) as T;
}
