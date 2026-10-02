"use client";

import {
  animate,
  useInView,
  useMotionValue,
  useReducedMotion,
  useTransform,
  motion,
} from "framer-motion";
import { useEffect, useRef } from "react";

/**
 * Número que cuenta desde 0 hasta `value` la primera vez que entra en pantalla (~1.4s, con
 * frenado al final). Con `prefers-reduced-motion` muestra el valor final directamente.
 *
 * El HTML del servidor ya trae el valor final (para buscadores y sin JS); el conteo arranca
 * de 0 recién cuando el número es visible, así que nunca se ve "saltar" hacia atrás.
 */
export function CountUp({
  value,
  prefix = "",
}: {
  value: number;
  prefix?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "0px 0px -60px 0px" });
  const reduced = useReducedMotion();
  const count = useMotionValue(value);
  const text = useTransform(count, (v) => `${prefix}${Math.round(v)}`);

  useEffect(() => {
    if (!inView || reduced) return;
    count.set(0);
    const controls = animate(count, value, {
      duration: 1.4,
      ease: [0.16, 1, 0.3, 1],
    });
    return () => controls.stop();
  }, [inView, reduced, value, count]);

  return <motion.span ref={ref}>{text}</motion.span>;
}
