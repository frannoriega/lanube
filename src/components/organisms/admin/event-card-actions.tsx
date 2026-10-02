"use client";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { CalendarCog, Check, Link2, Pencil, Users } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";

/** En teléfono: botón con ícono + texto a lo ancho de su celda; desde `sm`: ícono de 32px. */
const ACTION_CLASSES =
  "h-9 w-full justify-start gap-2 px-3 sm:h-8 sm:w-8 sm:justify-center sm:gap-0 sm:px-0";

/**
 * Quick actions for an event card: participants, copy form link, edit. Icon-only with
 * tooltips. Replaces the old whole-card link — the card body is now static and these are the
 * explicit, accessible affordances (no nested-interactive controls inside a giant link).
 *
 * Milestone 14 (hallazgo K): en un teléfono no hay hover, así que los tooltips no se ven y
 * cuatro íconos sueltos eran adivinanzas. Por debajo de `sm` cada acción muestra su texto en
 * una grilla de 2×2; desde `sm` vuelven a ser solo íconos con tooltip (el texto queda como
 * `sr-only`).
 */
export function EventCardActions({
  eventId,
  formSlug,
  formPublished,
  inline = false,
}: {
  eventId: string;
  formSlug: string | null;
  formPublished: boolean;
  /**
   * Dentro de una fila de la tabla de eventos (milestone 16) en vez de al pie de una tarjeta:
   * sin borde ni relleno propios.
   */
  inline?: boolean;
}) {
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => setOrigin(window.location.origin), []);
  const canCopy = formPublished && Boolean(formSlug);

  const copyLink = async () => {
    if (!canCopy) {
      toast.info(
        "Publicá el formulario para compartir el link de inscripción.",
      );
      return;
    }
    try {
      await navigator.clipboard.writeText(`${origin}/forms/${formSlug}`);
      setCopied(true);
      toast.success("Link copiado");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("No se pudo copiar el link");
    }
  };

  return (
    <div
      className={
        inline
          ? "grid w-full grid-cols-2 gap-1 sm:flex sm:w-auto sm:items-center sm:justify-end sm:gap-0.5"
          : "mt-auto grid grid-cols-2 gap-1 border-t px-4 py-2 sm:flex sm:items-center sm:justify-end sm:gap-0.5"
      }
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            asChild
            variant="ghost"
            size="icon"
            className={ACTION_CLASSES}
          >
            <Link
              href={`/admin/events/${eventId}/participants`}
              aria-label="Ver inscriptos"
            >
              <Users className="h-4 w-4" />
              <span className="sm:sr-only">Inscriptos</span>
            </Link>
          </Button>
        </TooltipTrigger>
        <TooltipContent>Ver inscriptos</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={`${ACTION_CLASSES} ${canCopy ? "" : "text-muted-foreground/60"}`}
            aria-label="Copiar link de inscripción"
            onClick={copyLink}
          >
            {copied ? (
              <Check className="h-4 w-4" />
            ) : (
              <Link2 className="h-4 w-4" />
            )}
            <span className="sm:sr-only">Copiar link</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {canCopy
            ? "Copiar link de inscripción"
            : "El formulario no está publicado"}
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            asChild
            variant="ghost"
            size="icon"
            className={ACTION_CLASSES}
          >
            <Link
              href={`/admin/events/${eventId}?sessions=1`}
              aria-label="Gestionar sesiones"
            >
              <CalendarCog className="h-4 w-4" />
              <span className="sm:sr-only">Sesiones</span>
            </Link>
          </Button>
        </TooltipTrigger>
        <TooltipContent>Gestionar sesiones</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            asChild
            variant="ghost"
            size="icon"
            className={ACTION_CLASSES}
          >
            <Link href={`/admin/events/${eventId}`} aria-label="Editar evento">
              <Pencil className="h-4 w-4" />
              <span className="sm:sr-only">Editar</span>
            </Link>
          </Button>
        </TooltipTrigger>
        <TooltipContent>Editar evento</TooltipContent>
      </Tooltip>
    </div>
  );
}
