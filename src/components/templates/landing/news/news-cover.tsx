import { COVER_VIEWBOX, coverPattern } from "@/lib/news/cover-pattern";
import { cn } from "@/lib/utils";
import { FramedImage } from "@/components/molecules/framed-image";

/**
 * Degradés de marca para la portada generada, indexados por `CoverPattern.variant`. Todos
 * combinan Observatory Blue con su registro oscuro o con Signal Cyan (nunca cyan solo — la
 * "Signal Cyan Rule" del DESIGN.md); la variante nocturna usa Night Station, el fondo del
 * modo oscuro, para que una grilla de notas sin imagen tenga algo de contraste entre sí.
 */
const GRADIENTS = [
  "bg-linear-to-br from-la-nube-selected to-la-nube-primary",
  "bg-linear-to-tr from-la-nube-primary to-la-nube-secondary",
  "bg-linear-to-r from-la-nube-selected via-la-nube-primary to-la-nube-secondary",
  "bg-linear-to-bl from-[#1c2238] via-la-nube-selected to-la-nube-primary",
] as const;

/**
 * Portada de una noticia: la imagen subida o, si no tiene, una portada generada — un
 * degradé de marca con una red de nodos determinística por slug (ver `coverPattern`).
 *
 * Reemplaza al viejo recuadro gris con un ícono tenue, que se leía como "la imagen no
 * cargó". La portada generada es decorativa (`aria-hidden`): el título de la nota ya está
 * en el texto de la tarjeta. El padre define el tamaño vía `className` (aspect ratio o alto).
 *
 * La imagen subida nunca se recorta (salvo `fit="cover"`, para miniaturas): se ve completa
 * sobre un fondo difuminado de sí misma — ver `FramedImage`.
 *
 * `zoomOnHover` escala el contenido cuando el ancestro `group` está en hover o tiene el foco
 * — lo usan las tarjetas, no el detalle.
 */
export function NewsCover({
  slug,
  title,
  imageUrl,
  className,
  sizes = "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw",
  priority,
  zoomOnHover = false,
  fit,
}: {
  slug: string;
  title: string;
  imageUrl: string | null;
  className?: string;
  sizes?: string;
  priority?: boolean;
  zoomOnHover?: boolean;
  /** Ver `FramedImage`: `"cover"` sólo para miniaturas chicas. */
  fit?: "contain" | "cover";
}) {
  const zoom =
    zoomOnHover &&
    "transition-transform duration-500 ease-out group-hover:scale-105 group-focus-within:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100";

  // La imagen subida se muestra entera dentro del marco (ver `FramedImage`): las portadas
  // suelen ser flyers verticales y recortarlas se comía el título.
  if (imageUrl) {
    return (
      <FramedImage
        src={imageUrl}
        alt={title}
        sizes={sizes}
        priority={priority}
        fit={fit}
        className={className}
        imageClassName={zoom || undefined}
      />
    );
  }

  return (
    <div className={cn("relative overflow-hidden bg-muted", className)}>
      <GeneratedCover slug={slug} className={cn("absolute inset-0", zoom)} />
    </div>
  );
}

/** El degradé + la red de nodos; separado para que `NewsCover` quede legible. */
function GeneratedCover({
  slug,
  className,
}: {
  slug: string;
  className?: string;
}) {
  const { variant, nodes, edges } = coverPattern(slug);
  return (
    <div className={cn(GRADIENTS[variant], className)} aria-hidden="true">
      <svg
        viewBox={`0 0 ${COVER_VIEWBOX.width} ${COVER_VIEWBOX.height}`}
        preserveAspectRatio="xMidYMid slice"
        className="h-full w-full"
      >
        <g stroke="white" strokeOpacity={0.4} strokeWidth={0.4}>
          {edges.map(([a, b]) => (
            <line
              key={`${a}-${b}`}
              x1={nodes[a].x}
              y1={nodes[a].y}
              x2={nodes[b].x}
              y2={nodes[b].y}
            />
          ))}
        </g>
        <g fill="white">
          {nodes.map((node, i) => (
            <circle
              key={i}
              cx={node.x}
              cy={node.y}
              r={node.r}
              fillOpacity={node.r > 2 ? 0.95 : 0.7}
            />
          ))}
        </g>
      </svg>
    </div>
  );
}
