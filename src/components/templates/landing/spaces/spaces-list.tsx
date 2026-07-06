"use client";

import { useState } from "react";
import { SpaceCard } from "./space-card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { SpaceWithFungible } from "@/lib/db/spaces";

const PAGE_SIZE = 4;

export function SpacesList({ spaces }: { spaces: SpaceWithFungible[] }) {
  const [page, setPage] = useState(0);
  const paginated = spaces.length > PAGE_SIZE;
  const totalPages = Math.ceil(spaces.length / PAGE_SIZE);
  const visible = paginated
    ? spaces.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
    : spaces;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        {visible.map((space) => (
          <SpaceCard key={space.id} space={space} />
        ))}
      </div>
      {paginated && (
        <div className="flex items-center justify-center gap-4 pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => p - 1)}
            disabled={page === 0}
            aria-label="Página anterior"
          >
            <ChevronLeft className="mr-1 h-4 w-4" />
            Anterior
          </Button>
          <span className="font-mono text-sm text-muted-foreground">
            {page + 1} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => p + 1)}
            disabled={page === totalPages - 1}
            aria-label="Página siguiente"
          >
            Siguiente
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
