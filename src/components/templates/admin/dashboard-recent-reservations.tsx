"use client";

import { AdminResourceTypeCombobox } from "@/components/molecules/admin-resource-type-combobox";
import { AdminReservationsCardsPanel } from "@/components/templates/admin/admin-reservations-cards-panel";
import {
  defaultAdminResourceServiceSlug,
  type AdminResourceServiceSlug,
} from "@/lib/admin/admin-resource-service-slug";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ResourceType } from "@/generated/prisma/enums";
import { Calendar } from "lucide-react";
import { useState } from "react";

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
    type: ResourceType;
    capacity: number;
    isExclusive: boolean;
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

export function DashboardRecentReservations({
  onAction,
  processing,
  refetchKey = 0,
}: {
  onAction: (
    id: string,
    action: "APPROVED" | "REJECTED",
    reason?: string,
  ) => void;
  processing: string | null;
  refetchKey?: number;
}) {
  const [service, setService] = useState<AdminResourceServiceSlug>(
    defaultAdminResourceServiceSlug(),
  );

  return (
    <Card className="glass-card dark:glass-card-dark">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Reservas recientes
        </CardTitle>
        <CardDescription>
          Esta semana y la próxima (Argentina). Elegí el tipo de recurso y
          expandí un día con reservas para ver la grilla y el detalle lateral.
        </CardDescription>
        <div className="pt-2">
          <p className="mb-1.5 text-sm font-medium text-muted-foreground">
            Tipo de recurso
          </p>
          <AdminResourceTypeCombobox value={service} onChange={setService} />
        </div>
      </CardHeader>
      <CardContent>
        <AdminReservationsCardsPanel
          variant="dashboard"
          serviceSlug={service}
          showHeading={false}
          onAction={onAction}
          processing={processing}
          refetchKey={refetchKey}
        />
      </CardContent>
    </Card>
  );
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
            type: resource.type as ResourceType,
            capacity:
              typeof resource.capacity === "number" ? resource.capacity : 1,
            isExclusive: Boolean(resource.isExclusive),
          }
        : {
            id: "",
            name: "",
            type: "COWORKING" as ResourceType,
            capacity: 1,
            isExclusive: false,
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
