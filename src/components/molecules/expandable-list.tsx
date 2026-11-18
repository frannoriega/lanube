"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { cn } from "@/lib/utils";

/**
 * Lista de filas que se abren en el lugar (milestone 35).
 *
 * Es el reemplazo de «una tarjeta dentro de otra tarjeta» y de «tocás una fila y se abre un
 * modal»: cada fila muestra lo justo (título, una línea de apoyo, un estado) y al tocarla se
 * expande hacia abajo con el detalle. Una sola abierta a la vez. Se dibuja como **un único
 * contenedor con divisores**, sin tarjetas anidadas — no lo envuelvas en un `Card`.
 *
 * Es de presentación: el contenido de cada fila lo decide quien la usa.
 */
export function ExpandableList({
  children,
  className,
  ariaLabel,
}: {
  children: React.ReactNode;
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <Accordion
      type="single"
      collapsible
      aria-label={ariaLabel}
      className={cn(
        "overflow-hidden rounded-lg border border-border bg-card",
        className,
      )}
    >
      {children}
    </Accordion>
  );
}

export function ExpandableRow({
  value,
  title,
  subtitle,
  trailing,
  children,
}: {
  /** Identifica la fila dentro de la lista. */
  value: string;
  title: React.ReactNode;
  /** Una línea de apoyo bajo el título (fecha, espacio…). */
  subtitle?: React.ReactNode;
  /** Lo que va a la derecha del título, antes del chevron (un estado). */
  trailing?: React.ReactNode;
  /** El detalle que aparece al abrir. */
  children: React.ReactNode;
}) {
  return (
    <AccordionItem value={value}>
      <AccordionTrigger className="items-center px-4 py-3 hover:bg-muted/50 hover:no-underline">
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate font-medium">{title}</span>
          {subtitle ? (
            <span className="truncate text-sm font-normal text-muted-foreground">
              {subtitle}
            </span>
          ) : null}
        </span>
        {trailing ? <span className="shrink-0">{trailing}</span> : null}
      </AccordionTrigger>
      <AccordionContent className="space-y-3 px-4 pb-4">
        {children}
      </AccordionContent>
    </AccordionItem>
  );
}
