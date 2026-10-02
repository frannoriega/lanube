import { eventTypeIcon } from "@/lib/constants/events";
import { cn } from "@/lib/utils";
import { FramedImage } from "@/components/molecules/framed-image";

/**
 * Event cover: the uploaded image, or — when there's none — a branded gradient with the
 * event-type icon. Giving every card a cover keeps grids aligned regardless of which events
 * have images. The parent sizes the box via `className` (e.g. aspect ratio / fixed height).
 *
 * La imagen subida no se recorta: se muestra completa sobre un fondo difuminado de sí misma
 * (ver `FramedImage`), porque suele ser un flyer vertical. `fit="cover"` recorta, y queda
 * sólo para miniaturas chicas.
 */
export function EventCover({
  imageUrl,
  name,
  eventType,
  className,
  sizes = "(max-width: 1024px) 100vw, 33vw",
  priority,
  fit,
}: {
  imageUrl: string | null;
  name: string;
  eventType: string;
  className?: string;
  sizes?: string;
  priority?: boolean;
  fit?: "contain" | "cover";
}) {
  const Icon = eventTypeIcon(eventType);
  if (imageUrl) {
    return (
      <FramedImage
        src={imageUrl}
        alt={name}
        sizes={sizes}
        priority={priority}
        fit={fit}
        className={className}
      />
    );
  }
  return (
    <div className={cn("relative overflow-hidden bg-muted", className)}>
      <div
        className="flex h-full w-full items-center justify-center bg-gradient-to-br from-la-nube-primary to-la-nube-secondary"
        aria-hidden="true"
      >
        <Icon className="h-10 w-10 text-white/85" />
      </div>
    </div>
  );
}
