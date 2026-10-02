import { Markdown } from "@/components/molecules/markdown";
import { FramedImage } from "@/components/molecules/framed-image";

/**
 * Participant-facing header for the public form pages. Shows the event's name,
 * description and (optional) image — never the internal form name.
 *
 * Always left-aligned: the description is markdown, and centering it breaks list/heading
 * layout and hurts readability. Body copy uses near-full foreground contrast (not muted gray)
 * so it stays legible in dark mode.
 */
export function EventHero({
  name,
  description,
  imageUrl,
}: {
  name: string;
  description?: string | null;
  imageUrl?: string | null;
}) {
  return (
    <div className="space-y-4">
      {imageUrl && (
        // Sin recorte: suele ser un flyer vertical (ver `FramedImage`). 4:3 para que no quede
        // diminuto en la columna angosta del formulario.
        <FramedImage
          src={imageUrl}
          alt={name}
          sizes="(max-width: 672px) 100vw, 672px"
          priority
          className="aspect-4/3 w-full rounded-lg border"
        />
      )}
      <div className="space-y-3">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {name}
        </h1>
        {description && (
          <Markdown className="text-[0.9375rem] leading-relaxed text-foreground/90">
            {description}
          </Markdown>
        )}
      </div>
    </div>
  );
}
