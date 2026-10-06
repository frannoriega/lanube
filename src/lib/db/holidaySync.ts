import { dateKeyFromUnixMs } from "@/lib/admin/admin-timezone";
import { nowMs } from "@/lib/clock";
import {
  holidayFeedSchema,
  holidaysFromFeed,
  planHolidaySync,
  type ExistingSyncRow,
  type SyncHoliday,
} from "@/lib/closed-days/holiday-sync";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

const FEED_URL = "https://api.argentinadatos.com/v1/feriados";
/** El pedido corre dentro de una request (cron o botón): no puede colgarla. */
const FETCH_TIMEOUT_MS = 10_000;

/** Resultado de una sincronización, para el aviso al admin, el cron y la auditoría. */
export interface HolidaySyncSummary {
  /** Años que se pudieron traer. */
  years: number[];
  /** Años cuyo pedido falló: no se concluyó nada sobre ellos. */
  failedYears: number[];
  created: number;
  refreshed: number;
  /** Feriados ya cargados que el origen dejó de traer (no se tocaron). */
  missing: { title: string; date: string }[];
}

async function fetchYear(year: number): Promise<SyncHoliday[]> {
  const res = await fetch(`${FEED_URL}/${year}`, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    // El origen cambia a lo sumo cuando sale un decreto: no hay que cachear de más, pero
    // tampoco golpearlo desde cada render.
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`ArgentinaDatos respondió ${res.status}`);
  const parsed = holidayFeedSchema.safeParse(await res.json());
  if (!parsed.success) throw new Error("Respuesta de ArgentinaDatos inválida");
  return holidaysFromFeed(parsed.data, year);
}

/**
 * Trae los feriados nacionales del año en curso y del siguiente y **propone** los que faltan
 * (`PENDING_REVIEW`): nada cierra el espacio hasta que un admin lo confirma. Idempotente por
 * `externalKey`. Si el origen falla para un año, ese año se saltea y se informa; nunca se
 * modifica nada a partir de un pedido fallido.
 *
 * No lanza por fallas del origen (devuelve `failedYears`); sí lanza ante un error de base.
 */
export async function syncNationalHolidays(): Promise<HolidaySyncSummary> {
  const todayKey = dateKeyFromUnixMs(nowMs());
  const thisYear = Number(todayKey.slice(0, 4));
  const wanted = [thisYear, thisYear + 1];

  const fetched: SyncHoliday[] = [];
  const years: number[] = [];
  const failedYears: number[] = [];
  for (const year of wanted) {
    try {
      fetched.push(...(await fetchYear(year)));
      years.push(year);
    } catch (err) {
      failedYears.push(year);
      logger.warn("holiday sync: no se pudo traer un año", {
        year,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const existingRows = await prisma.closedDay.findMany({
    where: { source: "NATIONAL_SYNC" },
    select: {
      id: true,
      externalKey: true,
      title: true,
      holidayKind: true,
      status: true,
      startDate: true,
    },
  });
  const existing: ExistingSyncRow[] = existingRows.flatMap((r) =>
    r.externalKey ? [{ ...r, externalKey: r.externalKey }] : [],
  );

  const plan = planHolidaySync(existing, fetched, years, todayKey);

  await prisma.$transaction([
    prisma.closedDay.createMany({
      data: plan.create.map((h) => ({
        title: h.title,
        startDate: h.date,
        endDate: h.date,
        source: "NATIONAL_SYNC" as const,
        status: "PENDING_REVIEW" as const,
        externalKey: h.externalKey,
        holidayKind: h.kind,
      })),
      // Dos sincronizaciones simultáneas (cron + botón) no pueden duplicar: la clave externa
      // es única, así que la segunda simplemente no inserta.
      skipDuplicates: true,
    }),
    ...plan.refresh.map((r) =>
      prisma.closedDay.update({
        where: { id: r.id },
        data: {
          title: r.holiday.title,
          holidayKind: r.holiday.kind,
          updatedAt: BigInt(nowMs()),
        },
      }),
    ),
  ]);

  return {
    years,
    failedYears,
    created: plan.create.length,
    refreshed: plan.refresh.length,
    missing: plan.missing.map((m) => ({ title: m.title, date: m.startDate })),
  };
}
