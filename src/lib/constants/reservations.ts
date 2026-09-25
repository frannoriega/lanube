/**
 * Tamaño del bucket en el ledger de reservas. `insert_into_ledger()` expande cada ocurrencia
 * en filas exactamente de este ancho, así que es la granularidad con la que se cuenta la
 * capacidad.
 */
export const LEDGER_SLOT_MS = 900_000; // 15 minutos

/**
 * ¿Este instante cae en la grilla de 15 minutos del ledger?
 *
 * El epoch Unix 0 es `1970-01-01T00:00:00Z`, así que los múltiplos de {@link LEDGER_SLOT_MS}
 * son exactamente los cuartos de hora UTC — y, como la zona del predio tiene un offset de
 * horas enteras y sin DST, también los cuartos de hora locales.
 *
 * Por qué se valida en lugar de simplemente asumirlo: los buckets del ledger se escriben desde
 * el inicio propio de cada reserva. Los inicios fuera de grilla hacían que el chequeo de
 * capacidad comparara grillas distintas y pasara vacuamente (milestone-12 D4). La slice B pasó
 * los predicados SQL a comparar rangos, así que una reserva fuera de grilla ya no es
 * *insegura* — pero mantener todo en una sola grilla es lo que permite comparar, fusionar e
 * indexar buckets de forma barata, así que el borde igual las rechaza.
 */
export function isOnLedgerGrid(ms: number): boolean {
  return Number.isFinite(ms) && ms % LEDGER_SLOT_MS === 0;
}
