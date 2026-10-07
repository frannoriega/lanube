import { Markdown } from "@/components/molecules/markdown";
import { FramedImage } from "@/components/molecules/framed-image";

/**
 * Participant-facing header for an event: the public event page (`/events/[id]`) and the
 * registration pages (`/forms/*`, via `EventFormLayout`). Shows the event's name, description
 * and (optional) image — never the internal form name.
 *
 * Always left-aligned: the description is markdown, and centering it breaks list/heading
 * layout and hurts readability. Body copy uses near-full foreground contrast (not muted gray)
 * so it stays legible in dark mode.
 *
 * `afterTitle` permite intercalar algo entre el título y la descripción (la ficha del evento en
 * teléfono, o la fila de metadatos en el formulario). Hasta el 2026-10-07 había una variante
 * `"form"` más chica para la tarjeta angosta del formulario; desde que el formulario usa el
 * ancho de la página, las dos superficies comparten esta.
 */
export function EventHero({
  name,
  description,
  imageUrl,
  afterTitle,
}: {
  name: string;
  description?: string | null;
  imageUrl?: string | null;
  afterTitle?: React.ReactNode;
}) {
  return (
    <div className="space-y-4">
      {imageUrl && (
        // Sin recorte: suele ser un flyer vertical (ver `FramedImage`). 4:3 para que no quede
        // diminuto.
        <FramedImage
          src={imageUrl}
          alt={name}
          sizes="(max-width: 1024px) 100vw, 768px"
          priority
          className="aspect-4/3 w-full rounded-2xl border shadow-sm"
        />
      )}
      <div className="space-y-3">
        <h1 className="text-3xl font-bold tracking-tight text-balance text-la-nube-ink md:text-4xl dark:text-white">
          {name}
        </h1>
        {afterTitle}
        {description && (
          <Markdown className="text-[0.9375rem] leading-relaxed text-foreground/90">
            {description}
          </Markdown>
        )}
      </div>
    </div>
  );
}
