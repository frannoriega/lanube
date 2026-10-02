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
    router.push(qs ? `/news?${qs}` : "/news");
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

  // Barra liviana, sin recuadro ni etiquetas visibles: vive en la misma fila que el título
  // del listado (a la derecha en `lg`) para no competir con las notas. Las etiquetas pasan a
  // `aria-label` / `sr-only`, así los lectores de pantalla siguen anunciando cada control.
  return (
    <div
      role="search"
      className="flex w-full flex-wrap items-center gap-2 lg:w-auto lg:flex-nowrap"
    >
      <div className="relative min-w-0 flex-1 basis-56 lg:w-72 lg:flex-none">
        <Label htmlFor="news-search" className="sr-only">
          Buscar noticias
        </Label>
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id="news-search"
          type="search"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Buscar noticias…"
          className="h-10 rounded-full bg-card pl-10"
        />
      </div>

      <DateRangePicker
        clearable
        value={{ from, to }}
        onChange={(range) => update({ from: range.from, to: range.to })}
        placeholder="Cualquier fecha"
        numberOfMonths={2}
        ariaLabel="Filtrar por fechas"
        className="h-10 w-auto rounded-full bg-card px-4"
      />

      {hasFilters && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-10 rounded-full"
          onClick={() => {
            setSearchInput("");
            router.push("/news");
          }}
        >
          <X className="h-4 w-4" />
          Limpiar
        </Button>
      )}
    </div>
  );
}
