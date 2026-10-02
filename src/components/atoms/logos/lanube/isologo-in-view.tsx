"use client";

import { useInView, useReducedMotion } from "framer-motion";
import { useRef } from "react";
import { AnimatedIsologo } from "./animated-isologo";

/**
 * El isologo que se dibuja solo la primera vez que entra en pantalla (coreografía `"draw"`):
 * los tres trazos, después los conectores y al final los nodos. Lo usa "La leyenda del logo"
 * en "Quiénes somos", que cuenta exactamente ese orden. Con `prefers-reduced-motion` se ve el
 * logo terminado.
 */
export function IsologoInView({ className }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.5 });
  const reduced = useReducedMotion();

  return (
    <div ref={ref} className={className}>
      <AnimatedIsologo
        mode="draw"
        state={reduced ? "static" : inView ? "play" : "hidden"}
        className="w-full"
      />
    </div>
  );
}
