"use client";

import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

/**
 * Barra de guardado fija al borde inferior de la ventana, con Guardar / Cancelar / … (los
 * botones van como `children` para que cada formulario ponga los suyos).
 *
 * **Por qué `fixed` y no `sticky`:** antes era `sticky bottom-0` dentro del contenedor
 * `max-w-7xl` del `ManagementLayout`. Eso fallaba con ventanas anchas (p. ej. zoom < 100%):
 *   1. si el formulario es más corto que la ventana, `sticky` nunca "pega" y la barra quedaba
 *      flotando a mitad de pantalla, justo debajo del formulario;
 *   2. su ancho quedaba limitado por `max-w-7xl`, así que se veía como una franja gris cortada
 *      en vez de ocupar todo el ancho del área de contenido.
 * Con `fixed` la barra siempre está abajo y ocupa todo el ancho a la derecha del sidebar
 * (`lg:left-64` = el `lg:w-64` del sidebar de `ManagementLayout`; si cambia, cambiar esto).
 *
 * Como `fixed` sale del flujo, un espaciador invisible del mismo alto (medido con
 * `ResizeObserver`, porque en el teléfono los botones pueden pasar a dos renglones) reserva el
 * lugar para que la barra nunca tape el final del formulario.
 */
export function StickySaveBar({
  dirty,
  children,
  className,
}: {
  /** Muestra el aviso "Cambios sin guardar". */
  dirty?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  const barRef = useRef<HTMLDivElement>(null);
  // Alto inicial aproximado (botón h-9 + py-3 + borde) para no saltar en el primer render.
  const [height, setHeight] = useState(61);

  useEffect(() => {
    const el = barRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setHeight(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <>
      <div aria-hidden style={{ height }} className="print:hidden" />
      <div
        ref={barRef}
        className={cn(
          "fixed inset-x-0 bottom-0 z-30 flex flex-wrap items-center justify-end gap-2 border-t bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:px-6 lg:left-64 lg:px-8 print:hidden",
          // Respeta el área segura inferior del iPhone (barra de gestos).
          "pb-[max(0.75rem,env(safe-area-inset-bottom))]",
          className,
        )}
      >
        {dirty ? (
          <span
            className="mr-auto w-full text-sm text-muted-foreground sm:w-auto"
            aria-live="polite"
          >
            Cambios sin guardar
          </span>
        ) : null}
        {children}
      </div>
    </>
  );
}
