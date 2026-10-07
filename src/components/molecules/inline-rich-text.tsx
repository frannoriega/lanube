import { type InlineNode, parseInlineMarks } from "@/lib/events/inline-format";
import { cn } from "@/lib/utils";
import { Fragment } from "react";

/**
 * Renders the event `summary`'s restricted inline formatting (**bold**, _italic_, ++underline++)
 * as `<strong>` / `<em>` / `<u>`. No block elements, no raw HTML — safe to show publicly.
 * Renders into the surrounding element (e.g. a `<p>`), so wrap it where you need the block.
 *
 * `overflow-wrap: anywhere`: una palabra larga sin espacios (una URL, «sarasasasa…») se corta
 * solo si no entra, en vez de ensanchar la tarjeta o el pie del editor del resumen. Mismo
 * arreglo que `Markdown` y `Textarea` (`break-words` no reduce el ancho mínimo del contenido).
 */
export function InlineRichText({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  const nodes = parseInlineMarks(text);
  return (
    <span className={cn("[overflow-wrap:anywhere]", className)}>
      {renderNodes(nodes)}
    </span>
  );
}

function renderNodes(nodes: InlineNode[]): React.ReactNode {
  return nodes.map((node, i) => (
    <Fragment key={i}>{renderNode(node)}</Fragment>
  ));
}

function renderNode(node: InlineNode): React.ReactNode {
  if (node.type === "text") return node.value;
  const children = renderNodes(node.children);
  switch (node.mark) {
    case "bold":
      return <strong className="font-semibold">{children}</strong>;
    case "italic":
      return <em>{children}</em>;
    case "underline":
      return <u>{children}</u>;
  }
}
