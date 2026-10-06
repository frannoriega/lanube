"use client";

import { ApiError, apiGet, invalidateApi } from "@/lib/api/client";
import { useCallback, useEffect, useRef, useState } from "react";

export type UseApiOptions<T> = {
  /** Converts the raw JSON payload into `T` (validation/normalization). */
  parse?: (raw: unknown) => T;
  /** How long a shared cached response stays fresh (default 10s). */
  ttlMs?: number;
  /**
   * Re-fetches silently every N ms (`loading` toggles, `firstTime` never returns). Pauses while
   * the tab is hidden and refreshes once when it becomes visible again.
   */
  refreshIntervalMs?: number;
};

export type UseApiResult<T> = {
  data: T | null;
  error: ApiError | null;
  /** A request is in flight (initial load or refresh). */
  loading: boolean;
  /**
   * Nothing has been loaded yet — render a pulse skeleton.
   * Once data exists, `loading` alone means a refresh: render a spinner.
   */
  firstTime: boolean;
  /** Bypasses the cache and reloads. Keeps current data while in flight. */
  refetch: () => Promise<void>;
};

/**
 * Data-loading hook for GET endpoints. When the URL changes, the previous
 * data is kept while the new request runs (stale-while-revalidate), so the
 * UI can show a spinner instead of collapsing back to a skeleton.
 * Pass `null` to stay idle (dependent queries).
 */
export function useApi<T>(
  url: string | null,
  options: UseApiOptions<T> = {},
): UseApiResult<T> {
  const { parse, ttlMs, refreshIntervalMs } = options;

  const parseRef = useRef(parse);
  parseRef.current = parse;
  const urlRef = useRef(url);
  urlRef.current = url;

  const [state, setState] = useState<{
    data: T | null;
    error: ApiError | null;
    loading: boolean;
  }>({ data: null, error: null, loading: url !== null });

  const load = useCallback(
    async (target: string, force: boolean) => {
      setState((s) => ({ ...s, loading: true }));
      try {
        const raw = await apiGet<unknown>(target, { ttlMs, force });
        if (urlRef.current !== target) return; // response for an outdated URL
        const data = parseRef.current ? parseRef.current(raw) : (raw as T);
        setState({ data, error: null, loading: false });
      } catch (err) {
        if (urlRef.current !== target) return;
        setState((s) => ({
          data: s.data,
          error:
            err instanceof ApiError
              ? err
              : new ApiError(0, null, "Error de red"),
          loading: false,
        }));
      }
    },
    [ttlMs],
  );

  useEffect(() => {
    if (!url) {
      setState({ data: null, error: null, loading: false });
      return;
    }
    load(url, false);
  }, [url, load]);

  // Sondeo pausado mientras la pestaña está oculta, y un refresco al volver (milestone 25, P1).
  // Antes seguía corriendo en segundo plano: el aviso de mantenimiento (todo visitante, todas
  // las páginas), la campanita y el check-in sondeaban aunque nadie mirara, y en Vercel cada
  // sondeo es una invocación facturada (la campanita, además, 2–3 consultas de sesión).
  useEffect(() => {
    if (!url || !refreshIntervalMs) return;
    let id: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (id === null) {
        id = setInterval(() => load(url, true), refreshIntervalMs);
      }
    };
    const stop = () => {
      if (id !== null) clearInterval(id);
      id = null;
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        stop();
      } else {
        load(url, true);
        start();
      }
    };
    if (document.visibilityState !== "hidden") start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [url, refreshIntervalMs, load]);

  const refetch = useCallback(async () => {
    const target = urlRef.current;
    if (!target) return;
    invalidateApi(target);
    await load(target, true);
  }, [load]);

  return {
    data: state.data,
    error: state.error,
    loading: state.loading,
    firstTime: state.data === null && state.error === null,
    refetch,
  };
}
