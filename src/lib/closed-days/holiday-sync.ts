import z from "zod";

/**
 * Lógica **pura** de la sincronización de feriados nacionales (milestone 23, slice 7): validar
 * la respuesta de ArgentinaDatos y decidir qué filas crear o refrescar. La red y la base viven
 * en `src/lib/db/holidaySync.ts`.
 *
 * Fuente: `GET https://api.argentinadatos.com/v1/feriados/{año}` → `[{ fecha, tipo, nombre }]`,
 * con `tipo` ∈ inamovible / trasladable / puente y la fecha ya **efectiva** (trasladada). No es
 * un servicio oficial (agrega los decretos del Boletín Oficial), por eso la sincronización
 * **propone** y un admin confirma.
 */

/** Una fila del origen, ya validada. */
export const holidayFeedSchema = z.array(
  z.object({
    fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    tipo: z.string().min(1).max(40),
    nombre: z.string().trim().min(1).max(100),
  }),
);

export interface SyncHoliday {
  /** `ar:YYYY-MM-DD`: identifica la fila del origen para que el upsert sea idempotente. */
  externalKey: string;
  title: string;
  date: string;
  kind: string;
}

/**
 * Pasa la respuesta a feriados propuestos. Descarta lo que no pertenece al año pedido: un
 * dato fuera de año en la respuesta de `/2026` es un error del origen, no algo para cerrar el
 * espacio. Si una fecha aparece repetida se queda la primera.
 */
export function holidaysFromFeed(
  feed: z.infer<typeof holidayFeedSchema>,
  year: number,
): SyncHoliday[] {
  const seen = new Set<string>();
  const out: SyncHoliday[] = [];
  for (const row of feed) {
    if (!row.fecha.startsWith(`${year}-`)) continue;
    const externalKey = `ar:${row.fecha}`;
    if (seen.has(externalKey)) continue;
    seen.add(externalKey);
    out.push({
      externalKey,
      title: row.nombre,
      date: row.fecha,
      kind: row.tipo,
    });
  }
  return out;
}

/** Lo que la base ya tiene de una fila sincronizada. */
export interface ExistingSyncRow {
  id: string;
  externalKey: string;
  title: string;
  holidayKind: string | null;
  status: "PENDING_REVIEW" | "ACTIVE" | "DISMISSED";
  startDate: string;
}

export interface SyncPlan {
  /** Feriados nuevos: entran como `PENDING_REVIEW`. */
  create: SyncHoliday[];
  /** Propuestas todavía sin revisar cuyo nombre o tipo cambió en el origen. */
  refresh: { id: string; holiday: SyncHoliday }[];
  /**
   * Filas que ya no figuran en el origen (el decreto cambió o se movió la fecha). **No se
   * tocan**: un cierre ya confirmado no se desactiva solo porque el origen cambie de opinión.
   * Solo se informan, para que un admin las revise a mano.
   */
  missing: ExistingSyncRow[];
}

/**
 * Decide qué hacer. Reglas (ver el doc del milestone, decisión 3):
 *  - Fila nueva y todavía no pasada → se crea `PENDING_REVIEW`.
 *  - Fila existente `PENDING_REVIEW` con nombre/tipo distinto → se refresca.
 *  - Fila existente `ACTIVE` o `DISMISSED` → no se toca (lo decidió una persona).
 *  - Fila existente futura que el origen ya no trae → se informa en `missing`.
 *
 * `years` son los años que se pidieron con éxito: solo entre ellos se puede afirmar que algo
 * «ya no figura» (si falló el pedido de 2027, no se concluye nada sobre sus filas). `todayKey`
 * evita avisar de feriados pasados.
 */
export function planHolidaySync(
  existing: readonly ExistingSyncRow[],
  fetched: readonly SyncHoliday[],
  years: readonly number[],
  todayKey: string,
): SyncPlan {
  const byKey = new Map(existing.map((e) => [e.externalKey, e]));
  const fetchedKeys = new Set(fetched.map((f) => f.externalKey));
  const create: SyncHoliday[] = [];
  const refresh: SyncPlan["refresh"] = [];

  for (const h of fetched) {
    const row = byKey.get(h.externalKey);
    if (!row) {
      // Un feriado que ya pasó no cierra nada: proponerlo solo llenaría «Por revisar».
      if (h.date >= todayKey) create.push(h);
    } else if (
      row.status === "PENDING_REVIEW" &&
      (row.title !== h.title || row.holidayKind !== h.kind)
    ) {
      refresh.push({ id: row.id, holiday: h });
    }
  }

  const missing = existing.filter(
    (e) =>
      !fetchedKeys.has(e.externalKey) &&
      e.status !== "DISMISSED" &&
      e.startDate >= todayKey &&
      years.some((y) => e.startDate.startsWith(`${y}-`)),
  );

  return { create, refresh, missing };
}
