import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Textarea de shadcn, que crece con el contenido (`field-sizing: content`).
 *
 * Ese mismo `field-sizing` hace que una palabra larga sin espacios (una URL, «sarasasasa…»)
 * se vuelva el **ancho mínimo** del textarea: dentro de un grid/flex (el `FormItem`) empujaba
 * todo el campo por fuera de su columna, encima del aside del formulario de eventos.
 * `overflow-wrap: anywhere` la corta solo si no entra (el texto normal sigue cortando en los
 * espacios) y, a diferencia de `break-words`, sí reduce ese ancho mínimo — el mismo arreglo
 * que `Markdown` (milestone 14, hallazgo O).
 */
function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "[overflow-wrap:anywhere] border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-input/30 flex field-sizing-content min-h-16 w-full rounded-md border bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
