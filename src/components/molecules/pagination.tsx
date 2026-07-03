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
  query,
}: {
  page: number;
  totalPages: number;
  basePath: string;
  /** Extra query params to preserve across pages (e.g. active filters). */
  query?: Record<string, string | undefined>;
}) {
  if (totalPages <= 1) return null;
  const atStart = page <= 1;
  const atEnd = page >= totalPages;

  const href = (p: number) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(query ?? {})) {
      if (v) params.set(k, v);
    }
    params.set("page", String(p));
    return `${basePath}?${params.toString()}`;
  };

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
          <Link href={href(page - 1)}>
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
          <Link href={href(page + 1)}>
            Siguiente
            <ChevronRight className="h-4 w-4" />
          </Link>
        </Button>
      )}
    </nav>
  );
}
