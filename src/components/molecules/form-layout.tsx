/**
 * Piezas compartidas para los formularios de página (milestone 14, Part B.4 "Form
 * conventions"). Antes cada formulario largo (evento, noticia, espacio, …) era una columna
 * plana de campos con los botones recién al final; estas piezas dan una estructura común:
 *
 *   - `FormPageLayout`: **columna principal + aside**. Desde `lg` el aside queda a la derecha
 *     y es sticky (Publicación, estado, acciones de zona de peligro…); por debajo se apila
 *     **después** del contenido principal (decisión del usuario: en el teléfono va al final).
 *   - `FormSection`: bloque con **título + una línea de descripción** (p. ej. Información /
 *     Agenda / Inscripción). Lleva `id` para que el índice pueda saltar a él.
 *   - `FormJumpIndex`: índice de secciones para escritorio (en vez de un wizard de pasos: los
 *     admins editan yendo y viniendo, así que todo queda en una página).
 *   - `StickySaveBar`: barra fija abajo con Guardar / Cancelar, visible siempre en
 *     formularios largos, con un aviso de "Cambios sin guardar".
 *
 * El guardia de cambios sin guardar vive aparte: `hooks/use-unsaved-changes-guard.ts` +
 * `UnsavedChangesDialog`.
 */
import { cn } from "@/lib/utils";

export function FormPageLayout({
  main,
  aside,
  className,
}: {
  main: React.ReactNode;
  aside?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid gap-6",
        aside && "lg:grid-cols-[minmax(0,1fr)_20rem]",
        className,
      )}
    >
      <div className="min-w-0 space-y-6">{main}</div>
      {aside ? (
        // `top-20`: debajo del header sticky de management (h-16) con un poco de aire.
        <aside className="min-w-0 space-y-6 lg:sticky lg:top-20 lg:self-start">
          {aside}
        </aside>
      ) : null}
    </div>
  );
}

export function FormSection({
  id,
  title,
  description,
  children,
  className,
  tone = "default",
}: {
  /** Ancla para `FormJumpIndex` (y para linkear directo a la sección). */
  id?: string;
  title: string;
  /** Una línea que dice para qué es la sección. */
  description?: string;
  children: React.ReactNode;
  className?: string;
  /** `danger` para la "Zona de peligro" (acciones destructivas, separadas del resto). */
  tone?: "default" | "danger";
}) {
  const headingId = id ? `${id}-title` : undefined;
  return (
    <section
      id={id}
      aria-labelledby={headingId}
      className={cn(
        // `scroll-mt-20`: que al saltar desde el índice el título no quede bajo el header.
        "scroll-mt-20 space-y-4 rounded-xl border bg-card p-4 text-card-foreground shadow-sm sm:p-6",
        tone === "danger" && "border-destructive/40",
        className,
      )}
    >
      <header className="space-y-1">
        <h2
          id={headingId}
          className={cn(
            "text-base leading-tight font-semibold",
            tone === "danger" && "text-destructive",
          )}
        >
          {title}
        </h2>
        {description ? (
          <p className="text-sm text-muted-foreground">{description}</p>
        ) : null}
      </header>
      {children}
    </section>
  );
}

/** Índice de secciones del formulario. Solo se muestra desde `lg` (en el teléfono, se scrollea). */
export function FormJumpIndex({
  sections,
}: {
  sections: Array<{ id: string; label: string }>;
}) {
  return (
    <nav aria-label="Secciones del formulario" className="hidden lg:block">
      <p className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
        En esta página
      </p>
      <ul className="space-y-1 border-l border-border">
        {sections.map((s) => (
          <li key={s.id}>
            <a
              href={`#${s.id}`}
              className="-ml-px block border-l-2 border-transparent py-1 pl-3 text-sm text-muted-foreground hover:border-border hover:text-foreground"
            >
              {s.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

// `StickySaveBar` necesita JS (mide su alto), así que vive en su propio módulo cliente; se
// re-exporta acá para que los formularios lo sigan importando junto con el resto.
export { StickySaveBar } from "@/components/molecules/sticky-save-bar";
