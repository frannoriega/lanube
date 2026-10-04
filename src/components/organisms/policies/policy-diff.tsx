import type { TextDiffLine, WordPart } from "@/lib/audit/text-diff";
import { cn } from "@/lib/utils";

/**
 * Diff entre dos versiones de una política (milestone 19): líneas agregadas en verde,
 * quitadas en rojo, y dentro de una línea reemplazada solo las palabras que cambiaron. Las
 * líneas iguales lejanas se colapsan. Mismo criterio visual que el diff de texto largo del
 * panel de auditoría (milestone 16), pero pensado para quien lee, no para un admin: sin
 * etiquetas técnicas.
 *
 * Server Component (sin estado): se muestra dentro de un `<details>` nativo.
 */
export function PolicyDiff({ lines }: { lines: TextDiffLine[] }) {
  if (lines.every((l) => l.op === "same" || l.op === "gap")) {
    return (
      <p className="text-sm text-muted-foreground">
        El texto no tiene diferencias.
      </p>
    );
  }
  return (
    <div className="overflow-hidden rounded-lg border text-sm leading-relaxed whitespace-pre-wrap break-words">
      {lines.map((line, i) => {
        if (line.op === "gap") {
          return (
            <div
              key={i}
              className="border-y border-dashed bg-muted/40 px-3 py-1 text-xs text-muted-foreground"
            >
              ⋯ {line.count}{" "}
              {line.count === 1 ? "línea igual" : "líneas iguales"}
            </div>
          );
        }
        if (line.op === "same") {
          return (
            <div key={i} className="px-3 py-1 text-muted-foreground">
              {line.text || " "}
            </div>
          );
        }
        const added = line.op === "add";
        return (
          <div
            key={i}
            className={cn(
              "flex gap-2 px-3 py-1",
              added
                ? "bg-green-50 text-green-900 dark:bg-green-950 dark:text-green-100"
                : "bg-red-50 text-red-900 dark:bg-red-950 dark:text-red-100",
            )}
          >
            <span aria-hidden className="select-none font-mono">
              {added ? "+" : "−"}
            </span>
            <span className="sr-only">{added ? "Agregado:" : "Quitado:"}</span>
            <span>
              {line.parts ? (
                <Parts parts={line.parts} added={added} />
              ) : (
                line.text || " "
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function Parts({ parts, added }: { parts: WordPart[]; added: boolean }) {
  return (
    <>
      {parts.map((p, i) =>
        p.op === "same" ? (
          <span key={i}>{p.text}</span>
        ) : (
          <mark
            key={i}
            className={cn(
              "rounded-sm px-0.5",
              added
                ? "bg-green-200 text-green-950 dark:bg-green-800 dark:text-green-50"
                : "bg-red-200 text-red-950 line-through dark:bg-red-800 dark:text-red-50",
            )}
          >
            {p.text}
          </mark>
        ),
      )}
    </>
  );
}
