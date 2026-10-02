"use client";

import { cn } from "@/lib/utils";
import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
} from "framer-motion";
import Image from "next/image";
import { useRef } from "react";

/**
 * Foto con parallax sutil (milestone 17): mientras el marco cruza la pantalla, la imagen se
 * desplaza ±6% dentro de él, así que parece "más lejos" que el texto. La imagen se escala 1.15
 * para que el desplazamiento nunca deje ver un borde vacío.
 *
 * Sólo para fotos de contenido (espacios, "Quiénes somos"); el marco define el tamaño con
 * `className` (p. ej. `aspect-[4/3]`). Con `prefers-reduced-motion` es una imagen quieta.
 */
export function ParallaxImage({
  src,
  alt,
  sizes,
  className,
  priority,
}: {
  src: string;
  alt: string;
  sizes: string;
  className?: string;
  priority?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const y = useTransform(scrollYProgress, [0, 1], ["-6%", "6%"]);

  return (
    <div ref={ref} className={cn("relative overflow-hidden", className)}>
      <motion.div
        className="absolute inset-0"
        style={reduced ? undefined : { y, scale: 1.15 }}
      >
        <Image
          src={src}
          alt={alt}
          fill
          sizes={sizes}
          className="object-cover"
          priority={priority}
        />
      </motion.div>
    </div>
  );
}
