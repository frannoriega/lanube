import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

/**
 * Renders standard (CommonMark + GFM) markdown for event descriptions. Raw HTML is NOT parsed
 * — react-markdown escapes it — so there's no HTML injection vector even though the content is
 * shown publicly. URLs are sanitized by react-markdown's default transform.
 *
 * Headings follow GitHub's scale: each level is a distinct size/weight (not just bold), and h1/h2
 * carry a bottom border, so a heading never reads as plain bold text. Images (`![alt](url)`) and
 * links open cleanly; external links open in a new tab.
 */

const components: Components = {
  a: ({ href, children, ...props }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
      {children}
    </a>
  ),
  // Shift every heading down one level (F2.9). This content is always embedded in a page
  // that already owns the <h1> — an event description, a news post body — so an author
  // starting with `#` produced a second h1 and a heading-order violation. The CSS above
  // still styles by tag name, so `#` keeps its h1 *appearance* while emitting an <h2>:
  // the visual scale the author picked is preserved, only the outline is corrected.
  h1: ({ children, ...props }) => <h2 {...props}>{children}</h2>,
  h2: ({ children, ...props }) => <h3 {...props}>{children}</h3>,
  h3: ({ children, ...props }) => <h4 {...props}>{children}</h4>,
  h4: ({ children, ...props }) => <h5 {...props}>{children}</h5>,
  h5: ({ children, ...props }) => <h6 {...props}>{children}</h6>,
  h6: ({ children, ...props }) => <h6 {...props}>{children}</h6>,
};

/**
 * Escala de lectura larga (`size="reading"`), pensada para el cuerpo de una noticia: texto
 * más grande y aireado, títulos con más aire arriba y sin el borde estilo GitHub (en un
 * artículo se lee como documentación), cita como bloque tintado — no como franja lateral,
 * que el DESIGN.md prohíbe — e imágenes con más margen. Se aplica *después* de las clases
 * base, así `cn`/tailwind-merge reemplaza las que chocan en lugar de sumarlas.
 */
const READING_CLASSES = [
  "space-y-5 text-base leading-[1.75] sm:text-lg text-pretty",
  "[&_h1]:mt-10 [&_h1]:border-0 [&_h1]:pb-0 [&_h1]:text-3xl [&_h1]:text-balance",
  // Ojo: los títulos se emiten un nivel más abajo (ver `components`), así que el `##` que
  // usa casi todo autor para secciones llega como <h3>. Por eso h3 es grande: con el cuerpo
  // en `text-lg`, un `text-xl` apenas se distinguía del párrafo.
  "[&_h2]:mt-12 [&_h2]:border-0 [&_h2]:pb-0 [&_h2]:text-3xl [&_h2]:text-balance",
  "[&_h3]:mt-10 [&_h3]:text-2xl [&_h3]:font-bold [&_h3]:leading-tight [&_h3]:text-balance",
  "[&_h4]:mt-8 [&_h4]:text-xl [&_h4]:font-bold",
  "[&_h5]:mt-6 [&_h5]:text-lg",
  "[&_li]:mt-1.5 [&_li]:pl-1",
  "[&_blockquote]:rounded-xl [&_blockquote]:border-0 [&_blockquote]:bg-la-nube-accent/40 [&_blockquote]:px-5 [&_blockquote]:py-4 [&_blockquote]:text-lg [&_blockquote]:text-foreground dark:[&_blockquote]:bg-la-nube-selected/20",
  "[&_img]:my-8 [&_img]:rounded-xl",
  "[&_hr]:my-10",
].join(" ");

export function Markdown({
  children,
  className,
  size = "default",
  breaks = false,
}: {
  children: string;
  className?: string;
  /**
   * Un salto de línea simple se ve como salto de línea (en CommonMark se pierde y las dos
   * líneas se funden en una). Pensado para textos cortos que alguien escribe a mano, como el
   * motivo de un mantenimiento; los artículos y descripciones siguen con la regla estándar.
   * Es CSS (`white-space: pre-line` en los párrafos), sin plugins.
   */
  breaks?: boolean;
  /**
   * `default`: la escala compacta de siempre (descripciones de eventos, previews del editor).
   * `reading`: cuerpo de artículo — ver {@link READING_CLASSES}.
   */
  size?: "default" | "reading";
}) {
  return (
    <div
      className={cn(
        "space-y-3 text-sm leading-relaxed",
        // Milestone 14 (hallazgo O): una palabra o URL larga sin espacios se salía de la
        // tarjeta del formulario público en el teléfono. `overflow-wrap: anywhere` permite
        // cortarla en cualquier punto *solo si no entra*; el texto normal sigue cortando en
        // los espacios. (`break-words` / `break-word` no alcanza: no reduce el ancho mínimo
        // del contenido, así que en un flex/grid igual empuja el contenedor.)
        "[overflow-wrap:anywhere]",
        // Las tablas GFM scrollean dentro de su propio bloque en vez de ensanchar la página.
        "[&_table]:block [&_table]:max-w-full [&_table]:overflow-x-auto",
        // Headings — GitHub-style tiers (size + weight + border), with breathing room above.
        "[&_h1]:mt-6 [&_h1]:mb-1 [&_h1]:border-b [&_h1]:border-border [&_h1]:pb-1 [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:leading-tight",
        "[&_h2]:mt-6 [&_h2]:mb-1 [&_h2]:border-b [&_h2]:border-border [&_h2]:pb-1 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:leading-tight",
        "[&_h3]:mt-5 [&_h3]:text-lg [&_h3]:font-semibold",
        "[&_h4]:mt-4 [&_h4]:text-base [&_h4]:font-semibold",
        "[&_h5]:mt-4 [&_h5]:text-sm [&_h5]:font-semibold",
        "[&_h6]:mt-4 [&_h6]:text-sm [&_h6]:font-semibold [&_h6]:text-muted-foreground",
        // First child never gets a top margin (avoids a gap at the top of the block).
        "[&>*:first-child]:mt-0",
        // Inline + block elements.
        "[&_a]:font-medium [&_a]:text-la-nube-selected [&_a]:underline dark:[&_a]:text-la-nube-secondary",
        "[&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground",
        "[&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.85em]",
        "[&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5",
        "[&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-muted [&_pre]:p-3 [&_pre_code]:bg-transparent [&_pre_code]:p-0",
        "[&_img]:my-2 [&_img]:max-w-full [&_img]:rounded-md [&_img]:border [&_img]:border-border",
        "[&_hr]:my-4 [&_hr]:border-border",
        size === "reading" && READING_CLASSES,
        breaks && "[&_p]:whitespace-pre-line",
        className,
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
