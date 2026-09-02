import { type InlineNode, parseInlineMarks } from "@/lib/events/inline-format";
import { Fragment } from "react";

/**
 * Renders the event `summary`'s restricted inline formatting (**bold**, _italic_, ++underline++)
 * as `<strong>` / `<em>` / `<u>`. No block elements, no raw HTML — safe to show publicly.
 * Renders into the surrounding element (e.g. a `<p>`), so wrap it where you need the block.
 */
export function InlineRichText({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  const nodes = parseInlineMarks(text);
  return <span className={className}>{renderNodes(nodes)}</span>;
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
