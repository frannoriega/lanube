/**
 * Types and parsers for the admin reservations list API
 * (GET /api/admin/reservations). Kept outside the components so both the
 * typed hooks and the templates can import them without cycles.
 */

/**
 * Lists reservations filtered by resource type, including basic user and resource info.
 */
export interface AdminReservationListResult {
  id: string;
  startTime: number;
  endTime: number;
  reason: string;
  status: string;
  createdAt: number;
  deniedReason?: string | null;
  /** Headcount for capacity (from reservation ledger; defaults to 1 if missing). */
  actorSize: number;
  resource: {
    id: string;
    name: string;
    capacity: number;
    isExclusive: boolean;
    spaceName: string;
  };
  registeredUser: {
    name: string;
    lastName: string;
    dni: string;
    institution: string | null;
    user: {
      email: string;
      displayEmail: string | null;
    };
  };
}

export interface DayWithReservations {
  date: string;
  count: number;
}

/** Normalizes API JSON (ms UTC or legacy ISO strings) into AdminReservationListResult. */
export function parseAdminReservationListFromApi(
  raw: unknown,
): AdminReservationListResult[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item: Record<string, unknown>) => {
    const resource = item.resource as Record<string, unknown> | undefined;
    const reg = item.registeredUser as Record<string, unknown> | undefined;
    const regUser = reg?.user as Record<string, unknown> | undefined;
    const displayRaw = regUser?.displayEmail;
    const registeredUser = reg
      ? {
          name: String(reg.name ?? ""),
          lastName: String(reg.lastName ?? ""),
          dni: String(reg.dni ?? ""),
          institution: (reg.institution as string | null | undefined) ?? null,
          user: {
            email: String(regUser?.email ?? ""),
            displayEmail:
              displayRaw != null && String(displayRaw).length > 0
                ? String(displayRaw)
                : null,
          },
        }
      : {
          name: "",
          lastName: "",
          dni: "",
          institution: null,
          user: { email: "", displayEmail: null },
        };
    return {
      ...item,
      startTime: new Date(item.startTime as string | number | Date).getTime(),
      endTime: new Date(item.endTime as string | number | Date).getTime(),
      createdAt: new Date(item.createdAt as string | number | Date).getTime(),
      actorSize: typeof item.actorSize === "number" ? item.actorSize : 1,
      registeredUser,
      resource: resource
        ? {
            id: String(resource.id),
            name: String(resource.name),
            capacity:
              typeof resource.capacity === "number" ? resource.capacity : 1,
            isExclusive: Boolean(resource.isExclusive),
            spaceName: String(resource.spaceName ?? ""),
          }
        : {
            id: "",
            name: "",
            capacity: 1,
            isExclusive: false,
            spaceName: "",
          },
    } as AdminReservationListResult;
  });
}

/** Parses grouped range response from GET /api/admin/reservations?service=&forwardWindow= */
export function parseItemsByDateFromApi(raw: unknown): {
  itemsByDate: Record<string, AdminReservationListResult[]>;
  fromKey: string;
  toKey: string;
} {
  if (!raw || typeof raw !== "object") {
    return { itemsByDate: {}, fromKey: "", toKey: "" };
  }
  const o = raw as Record<string, unknown>;
  const fromKey = String(o.fromKey ?? "");
  const toKey = String(o.toKey ?? "");
  const itemsByDate: Record<string, AdminReservationListResult[]> = {};
  const ibd = o.itemsByDate;
  if (ibd && typeof ibd === "object" && !Array.isArray(ibd)) {
    for (const k of Object.keys(ibd as Record<string, unknown>)) {
      itemsByDate[k] = parseAdminReservationListFromApi(
        (ibd as Record<string, unknown>)[k],
      );
    }
  }
  return { itemsByDate, fromKey, toKey };
}
