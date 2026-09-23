"use client";

import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw } from "lucide-react";

/**
 * Inline "this section failed to load" block with a retry.
 *
 * Milestone 10 / F1.2: `useApi` keeps `data: null` on failure and flips `loading` to
 * false, so a caller that renders only `data` shows its **empty state** when a request
 * fails — "no hay espacios" when `/api/admin/spaces` 500s reads as *the data is gone*,
 * which on a config page is the most alarming possible wrong message.
 *
 * Deliberately a per-caller component rather than a change to `useApi`: making the hook
 * throw into an `error.tsx` would take the whole page down when a secondary widget fails
 * (see `event-form.tsx`, which loads resources and templates alongside the real form).
 */
export function LoadError({
  message = "No se pudo cargar la información.",
  onRetry,
  busy = false,
}: {
  /** What failed, in the caller's own words. */
  message?: string;
  onRetry?: () => void;
  busy?: boolean;
}) {
  return (
    <div
      role="alert"
      className="flex flex-col gap-3 rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm sm:flex-row sm:items-center sm:justify-between"
    >
      <p className="flex items-start gap-2 text-foreground">
        <AlertTriangle
          className="mt-0.5 h-4 w-4 shrink-0 text-destructive"
          aria-hidden="true"
        />
        <span>{message}</span>
      </p>
      {onRetry && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onRetry}
          disabled={busy}
          className="shrink-0"
        >
          <RefreshCw
            className={`mr-2 h-4 w-4 ${busy ? "animate-spin" : ""}`}
            aria-hidden="true"
          />
          Reintentar
        </Button>
      )}
    </div>
  );
}
