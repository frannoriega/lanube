"use client";

import { DateRangePicker } from "@/components/molecules/date-range-picker";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Search, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

export function NewsFilters({
  q,
  from,
  to,
}: {
  q?: string;
  from?: string;
  to?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [searchInput, setSearchInput] = useState(q ?? "");

  const update = (patch: Record<string, string | undefined>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    params.delete("page"); // any filter change resets to the first page
    const qs = params.toString();
    router.push(qs ? `/noticias?${qs}` : "/noticias");
  };

  // Debounced: avoid a navigation per keystroke.
  useEffect(() => {
    const trimmed = searchInput.trim();
    if (trimmed === (q ?? "")) return;
    const timeout = setTimeout(() => update({ q: trimmed || undefined }), 400);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  const hasFilters = Boolean(q || from || to);

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-card p-3">
      <div className="min-w-[220px] flex-1 space-y-1.5">
        <Label className="text-xs text-muted-foreground">Buscar</Label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Título o contenido…"
            className="pl-9"
          />
        </div>
      </div>

      <div className="min-w-[220px] space-y-1.5">
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
          onClick={() => {
            setSearchInput("");
            router.push("/noticias");
          }}
        >
          <X className="h-4 w-4" />
          Limpiar
        </Button>
      )}
    </div>
  );
}
