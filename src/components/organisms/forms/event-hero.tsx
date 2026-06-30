import { Markdown } from "@/components/molecules/markdown";
import Image from "next/image";

/**
 * Participant-facing header for the public form pages. Shows the event's name,
 * description and (optional) image — never the internal form name.
 */
export function EventHero({
  name,
  description,
  imageUrl,
  align = "left",
}: {
  name: string;
  description?: string | null;
  imageUrl?: string | null;
  align?: "left" | "center";
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
      <div
        className={align === "center" ? "space-y-2 text-center" : "space-y-2"}
      >
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {name}
        </h1>
        {description && (
          <Markdown className="text-muted-foreground">{description}</Markdown>
        )}
      </div>
    </div>
  );
}
