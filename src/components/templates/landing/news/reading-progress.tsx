"use client";

import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Progreso de lectura de una noticia: una píldora flotante abajo con el porcentaje leído,
 * una barra sólida (sin degradé) y los minutos que faltan.
 *
 * Reemplaza a la línea con degradé que separaba el encabezado del cuerpo en notas sin
 * portada: se la leía como una barra de progreso que no avanzaba. Esta sí sigue al lector —
 * es `fixed`, así que se ve en todo momento mientras se lee el cuerpo.
 *
 * Mide sobre el **cuerpo** del artículo (el elemento con id `targetId`), no sobre la página
 * entera: el 0% es cuando el inicio del cuerpo llega al borde superior de la ventana y el
 * 100% cuando su final llega al borde inferior. Así el encabezado, el riel y el footer del
 * sitio no cuentan como "lectura".
 *
 * Aparece solo mientras el cuerpo está en pantalla y ya empezó; desaparece arriba (antes
 * de empezar) y al pasar el final. Si el cuerpo entra entero en la ventana no hay nada que
 * medir y no se muestra nunca.
 *
 * Se renderiza con un **portal en `document.body`**: dentro del árbol de la página, un
 * ancestro (el layout público) se vuelve el bloque contenedor de los `position: fixed`, y
 * la píldora quedaba anclada al final del contenido en lugar de a la ventana — scrolleaba
 * con la página y nunca se veía mientras se leía. El portal la saca de ese contexto.
 *
 * Posición: en teléfonos ocupa el ancho entre el borde izquierdo y el botón flotante de
 * WhatsApp (abajo a la derecha, 56px) para no taparlo; desde `sm` va centrada.
 */
export function ReadingProgress({
  targetId,
  minutes,
}: {
  targetId: string;
  /** Minutos estimados de la nota completa (ver `readingMinutes`). */
  minutes: number;
}) {
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  // El portal necesita `document`: se monta recién en el cliente.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const target = document.getElementById(targetId);
    if (!target) return;

    let frame = 0;
    const measure = () => {
      frame = 0;
      const rect = target.getBoundingClientRect();
      const viewport = window.innerHeight;
      const scrollable = rect.height - viewport;
      if (scrollable <= 0) {
        setVisible(false);
        return;
      }
      const p = Math.min(1, Math.max(0, -rect.top / scrollable));
      setProgress(p);
      // Visible desde que el cuerpo ocupa la mitad superior de la ventana hasta que su final
      // sube por encima del tercio inferior (el lector ya pasó al pie del artículo).
      setVisible(rect.top < viewport * 0.5 && rect.bottom > viewport * 0.66);
    };
    // Un solo cálculo por frame, aunque el navegador dispare muchos eventos de scroll.
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };

    measure();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [targetId]);

  const percent = Math.round(progress * 100);
  const remaining = Math.ceil(minutes * (1 - progress));

  if (!mounted) return null;

  return createPortal(
    <div
      aria-hidden={!visible}
      className={cn(
        "pointer-events-none fixed bottom-6 left-4 right-22 z-40 flex items-center gap-3 rounded-full border border-la-nube-primary/40 bg-card px-4 py-2 shadow-[0_4px_16px_0_rgba(78,135,194,0.2)] dark:bg-background",
        "sm:bottom-8 sm:left-1/2 sm:right-auto sm:-translate-x-1/2",
        "transition-[opacity,translate] duration-300 motion-reduce:transition-none",
        visible ? "opacity-100" : "translate-y-4 opacity-0",
      )}
    >
      <span className="w-9 shrink-0 text-right font-mono text-xs font-medium tabular-nums text-la-nube-selected dark:text-la-nube-secondary">
        {percent}%
      </span>
      <div
        role="progressbar"
        aria-label="Progreso de lectura"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-muted sm:w-40 sm:flex-none"
      >
        <div
          className="h-full rounded-full bg-la-nube-selected dark:bg-la-nube-secondary"
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className="shrink-0 font-mono text-xs text-muted-foreground">
        {remaining > 0 ? `quedan ${remaining} min` : "terminaste"}
      </span>
    </div>,
    document.body,
  );
}
