"use client";

import { LocalTimestamp } from "@/components/molecules/local-date";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useApi } from "@/hooks/use-api";
import { apiErrorMessage, apiSend } from "@/lib/api/client";
import { Bell, X } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string;
  readAt: number | null;
  createdAt: number;
}

interface NotificationsResponse {
  items: NotificationItem[];
  unreadCount: number;
}

/**
 * Bell icon with a dot while there's something unread, opening a dropdown of the user's
 * most recent notifications (see /api/user/notifications, backed by the pluggable system
 * in src/lib/notifications/). Polls every 60s so the dot can appear without a reload;
 * opening the popover marks everything currently loaded as read.
 *
 * Milestone 40 (F5): cada aviso se puede borrar («×») y el pie tiene «Borrar todas», que se
 * confirma **en el mismo popover** (nada de modales). El borrado es optimista: se oculta enseguida
 * y, si el servidor falla, vuelve a aparecer con un toast.
 */
export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const { data, refetch } = useApi<NotificationsResponse>(
    "/api/user/notifications",
    { refreshIntervalMs: 60_000 },
  );
  // Ids ocultos de forma optimista mientras el DELETE viaja (o "all" para todos).
  const [hidden, setHidden] = useState<Set<string> | "all">(() => new Set());
  const [confirmingClear, setConfirmingClear] = useState(false);
  const items = (data?.items ?? []).filter(
    (n) => hidden !== "all" && !hidden.has(n.id),
  );
  const unreadCount = data?.unreadCount ?? 0;

  const removeOne = async (id: string) => {
    setHidden((prev) => (prev === "all" ? prev : new Set([...prev, id])));
    try {
      await apiSend(`/api/user/notifications/${id}`, "DELETE");
    } catch (err) {
      toast.error(apiErrorMessage(err, "No se pudo borrar la notificación"));
    }
    await refetch().catch(() => {});
    setHidden((prev) => {
      if (prev === "all") return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const removeAll = async () => {
    setConfirmingClear(false);
    setHidden("all");
    try {
      await apiSend("/api/user/notifications", "DELETE");
    } catch (err) {
      toast.error(
        apiErrorMessage(err, "No se pudieron borrar las notificaciones"),
      );
    }
    await refetch().catch(() => {});
    setHidden(new Set());
  };

  const handleOpenChange = async (next: boolean) => {
    setOpen(next);
    if (!next) setConfirmingClear(false);
    if (next && unreadCount > 0) {
      try {
        await apiSend("/api/user/notifications/read", "POST", {});
        await refetch();
      } catch {
        // Best-effort: leaving the dot on until the next successful poll is harmless.
      }
    }
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={
            unreadCount > 0
              ? `Notificaciones (${unreadCount} sin leer)`
              : "Notificaciones"
          }
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span
              aria-hidden
              className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500"
            />
          )}
        </Button>
      </PopoverTrigger>
      {/* z-[110]: the shared management header is sticky at z-100, so the default z-50
          popover would render underneath it since this trigger lives inside that header. */}
      <PopoverContent align="end" className="z-[110] w-80 p-0">
        <div className="border-b border-border px-4 py-3 text-sm font-medium">
          Notificaciones
        </div>
        {items.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">
            No tenés notificaciones.
          </p>
        ) : (
          <div className="max-h-96 overflow-y-auto">
            {items.map((n) => (
              <div
                key={n.id}
                className={`group flex items-start gap-2 border-b border-border py-3 pl-4 pr-2 last:border-0 ${
                  n.readAt ? "" : "bg-muted/40"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{n.title}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {n.body}
                  </p>
                  <LocalTimestamp
                    ms={n.createdAt}
                    className="mt-1 block text-xs text-muted-foreground"
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0 text-muted-foreground"
                  aria-label="Borrar notificación"
                  onClick={() => void removeOne(n.id)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
        {items.length > 0 && (
          <div className="flex items-center justify-end gap-2 border-t border-border px-3 py-2">
            {confirmingClear ? (
              <>
                <span className="mr-auto text-xs text-muted-foreground">
                  ¿Borrar todas?
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setConfirmingClear(false)}
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={() => void removeAll()}
                >
                  Borrar todas
                </Button>
              </>
            ) : (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setConfirmingClear(true)}
              >
                Borrar todas
              </Button>
            )}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
