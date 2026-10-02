import { Markdown } from "@/components/molecules/markdown";
import { FramedImage } from "@/components/molecules/framed-image";

/**
 * Participant-facing header for the public form pages. Shows the event's name,
 * description and (optional) image — never the internal form name.
 *
 * Always left-aligned: the description is markdown, and centering it breaks list/heading
 * layout and hurts readability. Body copy uses near-full foreground contrast (not muted gray)
 * so it stays legible in dark mode.
 *
 * Milestone 17: `size="page"` es la variante de la página pública del evento (título grande en
 * azul noche, portada más redondeada) y `afterTitle` permite intercalar algo entre el título y
 * la descripción (allí, la ficha del evento en teléfono). Los formularios públicos siguen con
 * la variante `"form"` por defecto, sin cambios.
 */
export function EventHero({
  name,
  description,
  imageUrl,
  size = "form",
  afterTitle,
}: {
  name: string;
  description?: string | null;
  imageUrl?: string | null;
  size?: "form" | "page";
  afterTitle?: React.ReactNode;
}) {
  const page = size === "page";
  return (
    <div className="space-y-4">
      {imageUrl && (
        // Sin recorte: suele ser un flyer vertical (ver `FramedImage`). 4:3 para que no quede
        // diminuto en la columna angosta del formulario; en la página del evento, más redondeada.
        <FramedImage
          src={imageUrl}
          alt={name}
          sizes={
            page
              ? "(max-width: 1024px) 100vw, 768px"
              : "(max-width: 672px) 100vw, 672px"
          }
          priority
          className={
            page
              ? "aspect-4/3 w-full rounded-2xl border shadow-sm"
              : "aspect-4/3 w-full rounded-lg border"
          }
        />
      )}
      <div className="space-y-3">
        <h1
          className={
            page
              ? "text-3xl font-bold tracking-tight text-balance text-la-nube-ink md:text-4xl dark:text-white"
              : "text-2xl font-bold tracking-tight text-foreground"
          }
        >
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
