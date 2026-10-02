import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

/**
 * Grilla de KPIs compartida (milestone 14, hallazgo J).
 *
 * Antes cada pantalla (panel de usuario, panel de admin, check-in, usuarios) armaba sus
 * propias tarjetas con `grid-cols-1` en teléfonos, así que cuatro números ocupaban toda la
 * primera pantalla. Este par `StatGrid` + `StatTile` define un único patrón:
 *   - **< `md`:** 2 × 2 de tiles compactos (padding y número más chicos, sin la
 *     descripción secundaria), así los cuatro KPIs entran en un tercio de la pantalla.
 *   - **≥ `md`:** 2 columnas; **≥ `lg`:** 4 columnas, con el tamaño de siempre.
 *
 * Los colores de acento salen de `TONE_CLASSES` y tienen variante `dark:` para cada tono:
 * no pasar clases de paleta sueltas desde el llamador.
 */
export function StatGrid({
  children,
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

/** Tono del número (y del ícono). `default` usa el color de texto normal. */
export type StatTone =
  | "default"
  | "brand"
  | "success"
  | "warning"
  | "danger"
  | "info";

const TONE_CLASSES: Record<StatTone, { value: string; icon: string }> = {
  default: { value: "text-foreground", icon: "text-muted-foreground" },
  brand: {
    value: "text-la-nube-selected dark:text-la-nube-secondary",
    icon: "text-la-nube-selected dark:text-la-nube-secondary",
  },
  success: {
    value: "text-green-700 dark:text-green-400",
    icon: "text-green-600 dark:text-green-400",
  },
  warning: {
    value: "text-yellow-700 dark:text-yellow-400",
    icon: "text-yellow-600 dark:text-yellow-400",
  },
  danger: {
    value: "text-red-700 dark:text-red-400",
    icon: "text-red-600 dark:text-red-400",
  },
  info: {
    value: "text-indigo-700 dark:text-indigo-400",
    icon: "text-indigo-600 dark:text-indigo-400",
  },
};

export interface StatTileProps {
  /** Rótulo corto del KPI ("Próximas reservas"). */
  title: string;
  /** El número (o texto corto, p. ej. una hora) a destacar. */
  value: React.ReactNode;
  icon?: LucideIcon;
  /**
   * Aclaración de una línea. Solo se muestra desde `md`: en el tile compacto del teléfono
   * no entra, y el rótulo ya alcanza para entender el número.
   */
  description?: string;
  tone?: StatTone;
  /** Muestra un skeleton en lugar del valor (primera carga). */
  loading?: boolean;
  /** Para valores que son texto y no números (p. ej. "Actualizado 10:32"). */
  valueClassName?: string;
}

export function StatTile({
  title,
  value,
  icon: Icon,
  description,
  tone = "default",
  loading,
  valueClassName,
}: StatTileProps) {
  const toneClasses = TONE_CLASSES[tone];
  return (
    <Card className="glass-card dark:glass-card-dark gap-1 p-3 md:gap-2 md:p-6">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-xs leading-tight font-medium text-muted-foreground md:text-sm md:text-foreground">
          {title}
        </h3>
        {Icon ? (
          <Icon
            className={cn("h-4 w-4 shrink-0", toneClasses.icon)}
            aria-hidden
          />
        ) : null}
      </div>
      {loading ? (
        <Skeleton className="h-7 w-14 md:h-8 md:w-16" />
      ) : (
        <div
          className={cn(
            "text-xl font-bold tabular-nums md:text-2xl",
            toneClasses.value,
            valueClassName,
          )}
        >
          {value}
        </div>
      )}
      {description ? (
        <p className="hidden text-xs text-muted-foreground md:block">
          {description}
        </p>
      ) : null}
    </Card>
  );
}

/** Esqueleto de la grilla entera, para el estado de primera carga de una página. */
export function StatGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <StatGrid>
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} className="h-20 w-full md:h-28" />
      ))}
    </StatGrid>
  );
}
