"use client";

import { cn } from "@/lib/utils";
import { motion, useReducedMotion } from "framer-motion";

/**
 * Aparición suave al entrar en pantalla: el contenido sube 24px y se funde, **una sola vez**
 * (no se repite al volver a scrollear). Es el único efecto de scroll "general" del sitio
 * público (milestone 18): deliberadamente discreto, porque el fondo de partículas ya está en
 * movimiento y sumar efectos pesados de scroll lo volvería ruidoso.
 *
 * - Con `prefers-reduced-motion` no anima nada: renderiza el contenido tal cual.
 * - `delay` sirve para escalonar elementos hermanos (p. ej. tarjetas de una grilla).
 * - El HTML del servidor sale con `opacity: 0` hasta hidratar; el texto igual está en el DOM
 *   (buscadores y lectores de pantalla lo ven). Por eso se usa sólo debajo del primer pliegue:
 *   nunca envolver el hero, o el contenido principal arrancaría invisible.
 */
export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const reduced = useReducedMotion();
  if (reduced) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={cn(className)}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -80px 0px" }}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
