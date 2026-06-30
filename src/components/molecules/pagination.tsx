import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";

/**
 * Page navigation backed by a `?page=` query param. Renders nothing for a single page; the
 * edge buttons become non-interactive (not links) at the first/last page.
 */
export function Pagination({
  page,
  totalPages,
  basePath,
}: {
  page: number;
  totalPages: number;
  basePath: string;
}) {
  if (totalPages <= 1) return null;
  const atStart = page <= 1;
  const atEnd = page >= totalPages;

  return (
    <nav
      className="flex items-center justify-center gap-3"
      aria-label="Paginación"
    >
      {atStart ? (
        <Button variant="outline" size="sm" disabled>
          <ChevronLeft className="h-4 w-4" />
          Anterior
        </Button>
      ) : (
        <Button asChild variant="outline" size="sm">
          <Link href={`${basePath}?page=${page - 1}`}>
            <ChevronLeft className="h-4 w-4" />
            Anterior
          </Link>
        </Button>
      )}

      <span className="text-sm tabular-nums text-muted-foreground">
        Página {page} de {totalPages}
      </span>

      {atEnd ? (
        <Button variant="outline" size="sm" disabled>
          Siguiente
          <ChevronRight className="h-4 w-4" />
        </Button>
      ) : (
        <Button asChild variant="outline" size="sm">
          <Link href={`${basePath}?page=${page + 1}`}>
            Siguiente
            <ChevronRight className="h-4 w-4" />
          </Link>
        </Button>
      )}
    </nav>
  );
}
