import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * The one status badge (milestone 10 / F2.6, F2.7).
 *
 * There used to be four near-identical `switch` statements — here, `users/columns.tsx`,
 * `incidents/page.tsx` and `checkin/page.tsx` — each mapping a status to a
 * `bg-*-100 text-*-800` pair with **no `dark:` sibling**. In dark mode that renders a
 * light pastel chip on a dark card: not a text-contrast failure (the pairs are ~6:1
 * internally) but a jarring light patch, and four places to forget when adding a status.
 *
 * Tones are defined once, with both themes, and every caller picks a `tone` rather than
 * writing color classes.
 */
export type StatusTone = "success" | "danger" | "warning" | "info" | "neutral";

const TONE_CLASSES: Record<StatusTone, string> = {
  success:
    "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200 border-transparent",
  danger:
    "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200 border-transparent",
  warning:
    "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200 border-transparent",
  info: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200 border-transparent",
  neutral:
    "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200 border-transparent",
};

export function ToneBadge({
  tone,
  children,
  className,
}: {
  tone: StatusTone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Badge className={cn(TONE_CLASSES[tone], className)}>{children}</Badge>
  );
}

/** Reservation status. */
const RESERVATION_STATUSES: Record<
  string,
  { tone: StatusTone; label: string }
> = {
  APPROVED: { tone: "success", label: "Aprobada" },
  REJECTED: { tone: "danger", label: "Rechazada" },
  PENDING: { tone: "warning", label: "Pendiente" },
  CANCELLED: { tone: "neutral", label: "Cancelada" },
};

export function StatusBadge({ status }: { status: string }) {
  const known = RESERVATION_STATUSES[status];
  return (
    <ToneBadge tone={known?.tone ?? "neutral"}>
      {known?.label ?? status}
    </ToneBadge>
  );
}

/** User account status (admin users table). */
const USER_STATUSES: Record<string, { tone: StatusTone; label: string }> = {
  ACTIVE: { tone: "success", label: "Activo" },
  BANNED: { tone: "danger", label: "Bloqueado" },
  INACTIVE: { tone: "neutral", label: "Inactivo" },
};

export function UserStatusBadge({ status }: { status?: string | null }) {
  if (!status) return <Badge variant="outline">Sin estado</Badge>;
  const known = USER_STATUSES[status.toUpperCase()];
  if (!known) return <Badge variant="outline">{status}</Badge>;
  return <ToneBadge tone={known.tone}>{known.label}</ToneBadge>;
}

/** Incident status. */
const INCIDENT_STATUSES: Record<string, { tone: StatusTone; label: string }> = {
  OPEN: { tone: "danger", label: "Abierto" },
  RESOLVED: { tone: "success", label: "Resuelto" },
  CLOSED: { tone: "neutral", label: "Cerrado" },
};

export function IncidentStatusBadge({ status }: { status: string }) {
  const known = INCIDENT_STATUSES[status];
  return (
    <ToneBadge tone={known?.tone ?? "neutral"}>
      {known?.label ?? status}
    </ToneBadge>
  );
}
