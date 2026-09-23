"use client";

import { Button } from "@/components/ui/button";
import { AlertTriangle, Home, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";

/**
 * Shared body for every `error.tsx` boundary (milestone 10 / F1.1).
 *
 * Before this, an uncaught render error in a Server Component fell through to Next's
 * default boundary — in production a bare "Application error: a client-side exception has
 * occurred", unbranded, in English, with no way back other than the browser's back button.
 *
 * Note what is deliberately NOT rendered: `error.message`. Next already strips server
 * error messages in production builds, but a client-side throw keeps its real message, and
 * that is exactly the leak F1.1 flagged. The `digest` is safe — it is the correlation id
 * for the server-side log — so it is shown small, for support.
 */
export function ErrorBoundaryScreen({
  error,
  reset,
  /** Where "volver" goes. Defaults to the public home. */
  homeHref = "/",
  homeLabel = "Ir al inicio",
  title = "Algo salió mal",
  description = "No pudimos mostrar esta página. Podés reintentar; si vuelve a fallar, avisanos.",
}: {
  error: Error & { digest?: string };
  reset: () => void;
  homeHref?: string;
  homeLabel?: string;
  title?: string;
  description?: string;
}) {
  useEffect(() => {
    // The boundary is the last place this error is visible at all — log it so a
    // reproducible failure leaves a trace in the browser console too.
    console.error("[error-boundary]", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 px-4 py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
        <AlertTriangle
          className="h-7 w-7 text-destructive"
          aria-hidden="true"
        />
      </div>
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-foreground">{title}</h1>
        <p className="mx-auto max-w-prose text-muted-foreground">
          {description}
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button type="button" onClick={reset}>
          <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
          Reintentar
        </Button>
        <Button asChild variant="outline">
          <Link href={homeHref}>
            <Home className="mr-2 h-4 w-4" aria-hidden="true" />
            {homeLabel}
          </Link>
        </Button>
      </div>
      {error.digest && (
        <p className="text-xs text-muted-foreground">
          Código de referencia:{" "}
          <code className="font-mono">{error.digest}</code>
        </p>
      )}
    </div>
  );
}
