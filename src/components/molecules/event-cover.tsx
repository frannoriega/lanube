import { eventTypeIcon } from "@/lib/constants/events";
import { cn } from "@/lib/utils";
import Image from "next/image";

/**
 * Event cover: the uploaded image, or — when there's none — a branded gradient with the
 * event-type icon. Giving every card a cover keeps grids aligned regardless of which events
 * have images. The parent sizes the box via `className` (e.g. aspect ratio / fixed height).
 */
export function EventCover({
  imageUrl,
  name,
  eventType,
  className,
  sizes = "(max-width: 1024px) 100vw, 33vw",
  priority,
}: {
  imageUrl: string | null;
  name: string;
  eventType: string;
  className?: string;
  sizes?: string;
  priority?: boolean;
}) {
  const Icon = eventTypeIcon(eventType);
  return (
    <div className={cn("relative overflow-hidden bg-muted", className)}>
      {imageUrl ? (
        <Image
          src={imageUrl}
          alt={name}
          fill
          sizes={sizes}
          className="object-cover"
          priority={priority}
        />
      ) : (
        <div
          className="flex h-full w-full items-center justify-center bg-gradient-to-br from-la-nube-primary to-la-nube-secondary"
          aria-hidden="true"
        >
          <Icon className="h-10 w-10 text-white/85" />
        </div>
      )}
    </div>
  );
}
