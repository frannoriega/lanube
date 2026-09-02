import { Markdown } from "@/components/molecules/markdown";
import Image from "next/image";

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
        <div className="relative aspect-[16/9] w-full overflow-hidden rounded-lg border bg-muted">
          <Image
            src={imageUrl}
            alt={name}
            fill
            sizes="(max-width: 672px) 100vw, 672px"
            className="object-cover"
            priority
          />
        </div>
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
