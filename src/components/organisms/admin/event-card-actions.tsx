"use client";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Check, Link2, Pencil, Users } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";

/**
 * Quick actions for an event card: participants, copy form link, edit. Icon-only with
 * tooltips. Replaces the old whole-card link — the card body is now static and these are the
 * explicit, accessible affordances (no nested-interactive controls inside a giant link).
 */
export function EventCardActions({
  eventId,
  formSlug,
  formPublished,
}: {
  eventId: string;
  formSlug: string | null;
  formPublished: boolean;
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
    <div className="mt-auto flex items-center justify-end gap-0.5 border-t px-4 py-2">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button asChild variant="ghost" size="icon" className="h-8 w-8">
            <Link
              href={`/admin/events/${eventId}/participants`}
              aria-label="Ver inscriptos"
            >
              <Users className="h-4 w-4" />
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
            className={`h-8 w-8 ${canCopy ? "" : "text-muted-foreground/60"}`}
            aria-label="Copiar link de inscripción"
            onClick={copyLink}
          >
            {copied ? (
              <Check className="h-4 w-4" />
            ) : (
              <Link2 className="h-4 w-4" />
            )}
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
          <Button asChild variant="ghost" size="icon" className="h-8 w-8">
            <Link href={`/admin/events/${eventId}`} aria-label="Editar evento">
              <Pencil className="h-4 w-4" />
            </Link>
          </Button>
        </TooltipTrigger>
        <TooltipContent>Editar evento</TooltipContent>
      </Tooltip>
    </div>
  );
}
