"use client";

import { DateRangePicker } from "@/components/molecules/date-range-picker";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  EVENT_STATUS_LABELS,
  type EventDisplayStatus,
} from "@/lib/constants/events";
import { X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";

const STATUS_OPTIONS: EventDisplayStatus[] = [
  "DRAFT",
  "PUBLISHED",
  "PAUSED",
  "ENDED",
  "CANCELLED",
];

const RESOURCE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "AUDITORIUM", label: "Auditorio" },
  { value: "COWORKING", label: "Coworking" },
  { value: "LAB", label: "Laboratorio" },
  { value: "MEETING", label: "Sala de reuniones" },
];

const ALL = "ALL";

export function EventFilters({
  status,
  resourceType,
  from,
  to,
}: {
  status?: string;
  resourceType?: string;
  from?: string;
  to?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const update = (patch: Record<string, string | undefined>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    params.delete("page"); // any filter change resets to the first page
    const qs = params.toString();
    router.push(qs ? `/admin/events?${qs}` : "/admin/events");
  };

  const hasFilters = Boolean(status || resourceType || from || to);

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-card p-3">
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Estado</Label>
        <Select
          value={status ?? ALL}
          onValueChange={(v) => update({ status: v === ALL ? undefined : v })}
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos</SelectItem>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s} value={s}>
                {EVENT_STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Recurso</Label>
        <Select
          value={resourceType ?? ALL}
          onValueChange={(v) => update({ resource: v === ALL ? undefined : v })}
        >
          <SelectTrigger className="w-[170px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos</SelectItem>
            {RESOURCE_OPTIONS.map((r) => (
              <SelectItem key={r.value} value={r.value}>
                {r.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="min-w-[220px] flex-1 space-y-1.5">
        <Label className="text-xs text-muted-foreground">Fechas</Label>
        <DateRangePicker
          clearable
          value={{ from, to }}
          onChange={(range) => update({ from: range.from, to: range.to })}
          placeholder="Cualquier fecha"
          numberOfMonths={2}
          ariaLabel="Filtrar por fechas"
        />
      </div>

      {hasFilters && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => router.push("/admin/events")}
        >
          <X className="h-4 w-4" />
          Limpiar
        </Button>
      )}
    </div>
  );
}
