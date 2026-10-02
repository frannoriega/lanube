/*
 * Sin "use client" a propósito: la página (Server Component) le pasa íconos de lucide, que
 * son componentes y no se pueden serializar hacia un Client Component. Al no ser cliente,
 * lo pueden usar tanto la página como `event-schedule.tsx`.
 */

/** Un dato de la ficha: ícono + etiqueta chica + valor (uno o más renglones). */
export function Fact({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <Icon className="mt-0.5 size-4 shrink-0 text-la-nube-selected dark:text-la-nube-secondary" />
      <div className="flex min-w-0 flex-col gap-0.5 text-sm">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <div className="flex flex-col gap-0.5 font-medium text-foreground">
          {children}
        </div>
      </div>
    </div>
  );
}
