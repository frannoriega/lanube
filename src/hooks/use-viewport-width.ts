"use client";

import { useEffect, useState } from "react";

/**
 * Returns the current viewport width in pixels.
 * Returns undefined during SSR and on initial client mount until the first measurement.
 */
export function useViewportWidth(): number | undefined {
  // Arranca en `undefined` también en el cliente, como promete el comentario de arriba: leer
  // `window.innerWidth` en el inicializador hacía que el primer render del cliente no
  // coincidiera con el HTML del servidor (error de hidratación en las marquesinas de la
  // landing en celulares). Quedó a la vista cuando el sitio público volvió a renderizarse en el
  // servidor (ver `particles-layout.tsx`). El efecto mide enseguida después de montar.
  const [width, setWidth] = useState<number | undefined>(undefined);

  useEffect(() => {
    const updateWidth = () => setWidth(window.innerWidth);

    updateWidth();

    window.addEventListener("resize", updateWidth);
    return () => window.removeEventListener("resize", updateWidth);
  }, []);

  return width;
}
