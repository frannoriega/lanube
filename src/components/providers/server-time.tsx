"use client";

/**
 * Aligns the browser wall clock with the server on hydrate (see root `layout.tsx`).
 * Server code uses `@/lib/clock` instead; both follow the same Node/DB time under faketime.
 */

import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

export type ServerTimeContextValue = {
  /** Wall clock aligned to the server at hydrate time; advances with the client clock. */
  now: () => Date;
  /** Increments after server/client offset is applied (recompute "today"-derived state). */
  alignRevision: number;
};

const ServerTimeContext = createContext<ServerTimeContextValue | null>(null);

export function useServerTime(): ServerTimeContextValue {
  const ctx = useContext(ServerTimeContext);
  const fallbackNow = useCallback(() => new Date(), []);
  if (!ctx) {
    return { now: fallbackNow, alignRevision: 0 };
  }
  return ctx;
}

export function ServerTimeProvider({
  serverNowMs,
  children,
}: Readonly<{
  serverNowMs: number;
  children: React.ReactNode;
}>) {
  const offsetRef = useRef(0);
  const [alignRevision, setAlignRevision] = useState(0);

  useLayoutEffect(() => {
    offsetRef.current = serverNowMs - Date.now();
    setAlignRevision((r) => r + 1);
  }, [serverNowMs]);

  const now = useCallback(() => new Date(Date.now() + offsetRef.current), []);

  const value = useMemo(() => ({ now, alignRevision }), [now, alignRevision]);

  return (
    <ServerTimeContext.Provider value={value}>
      {children}
    </ServerTimeContext.Provider>
  );
}
