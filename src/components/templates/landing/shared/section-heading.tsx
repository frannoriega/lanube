import { cn } from "@/lib/utils";

/**
 * Encabezado de sección del sitio público: eyebrow tipo terminal (`~/ eventos▌`), título con la
 * última palabra en el degradé de marca, y una bajada opcional.
 *
 * Antes cada sección de la landing (y el "Quiénes somos") repetía este mismo bloque a mano, con
 * pequeñas diferencias de tamaño y color. Centralizarlo (milestone 18) permite que el
 * experimento de marca cambie el tono de los títulos —azul noche `la-nube-ink` en vez del gris
 * neutro— en un único lugar, y deja el ritmo visual en manos del *contenido* de cada sección
 * (que es lo que varía), no de encabezados ligeramente distintos.
 *
 * - `accent`: la palabra final en degradé (se separa del resto con un espacio).
 * - `action`: un enlace a la derecha del bloque en `sm+` (p. ej. "Ver todas").
 * - `tone="inverse"`: para franjas oscuras (fondo `la-nube-night`), título blanco.
 * - `as`: el nivel del título; `h2` por defecto, `h1` en las cabeceras de página.
 */
export function SectionHeading({
  eyebrow,
  title,
  accent,
  lead,
  id,
  action,
  tone = "default",
  as: Tag = "h2",
  className,
}: {
  eyebrow: string;
  title: React.ReactNode;
  accent?: string;
  lead?: React.ReactNode;
  id?: string;
  action?: React.ReactNode;
  tone?: "default" | "inverse";
  as?: "h1" | "h2";
  className?: string;
}) {
  const inverse = tone === "inverse";
  return (
    <div
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between",
        className,
      )}
    >
      <div className="flex flex-col gap-3">
        <span
          className={cn(
            "font-mono text-sm font-medium uppercase tracking-[0.2em]",
            inverse
              ? "text-la-nube-secondary"
              : "text-la-nube-selected dark:text-la-nube-secondary",
          )}
        >
          ~/ {eyebrow}
          <span className="animate-blink" aria-hidden>
            ▌
          </span>
        </span>
        <Tag
          id={id}
          className={cn(
            "text-4xl font-bold tracking-tight text-balance md:text-5xl",
            inverse ? "text-white" : "text-la-nube-ink dark:text-white",
          )}
        >
          {title}
          {accent && (
            <>
              {" "}
              <span className="bg-linear-to-r from-la-nube-primary to-la-nube-secondary bg-clip-text text-transparent">
                {accent}
              </span>
            </>
          )}
        </Tag>
        {lead && (
          <p
            className={cn(
              "max-w-prose text-lg text-pretty",
              inverse ? "text-white/75" : "text-muted-foreground",
            )}
          >
            {lead}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}
