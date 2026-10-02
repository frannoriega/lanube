"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Devuelve si la media query CSS `query` coincide ahora mismo, y se re-renderiza cuando
 * cambia (rotar el teléfono, redimensionar la ventana).
 *
 * Usa `useSyncExternalStore` en vez de `useState` + `useEffect` para no pintar un primer
 * frame con el valor equivocado en el cliente. En el servidor no hay `window`, así que
 * devuelve `serverValue` (por defecto `false`); elegí el valor que menos "salte" para el
 * componente que lo usa.
 *
 * @example
 *   const isDesktop = useMediaQuery("(min-width: 768px)");
 */
export function useMediaQuery(query: string, serverValue = false): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => serverValue,
  );
}
