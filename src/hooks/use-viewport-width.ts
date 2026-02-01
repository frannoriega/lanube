"use client";

import { useEffect, useState } from "react";

/**
 * Returns the current viewport width in pixels.
 * Returns undefined during SSR and on initial client mount until the first measurement.
 */
export function useViewportWidth(): number | undefined {
  const [width, setWidth] = useState<number | undefined>(() =>
    typeof window !== "undefined" ? window.innerWidth : undefined
  );

  useEffect(() => {
    const updateWidth = () => setWidth(window.innerWidth);

    updateWidth();

    window.addEventListener("resize", updateWidth);
    return () => window.removeEventListener("resize", updateWidth);
  }, []);

  return width;
}
