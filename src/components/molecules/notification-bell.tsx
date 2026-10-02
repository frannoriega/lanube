"use client";

import { LocalTimestamp } from "@/components/molecules/local-date";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useApi } from "@/hooks/use-api";
import { apiSend } from "@/lib/api/client";
import { Bell } from "lucide-react";
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
 */
export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const { data, refetch } = useApi<NotificationsResponse>(
    "/api/user/notifications",
    { refreshIntervalMs: 60_000 },
  );
  const items = data?.items ?? [];
  const unreadCount = data?.unreadCount ?? 0;

  const handleOpenChange = async (next: boolean) => {
    setOpen(next);
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
                className={`border-b border-border px-4 py-3 last:border-0 ${
                  n.readAt ? "" : "bg-muted/40"
                }`}
              >
                <p className="text-sm font-medium">{n.title}</p>
                <p className="mt-0.5 text-sm text-muted-foreground">{n.body}</p>
                <LocalTimestamp
                  ms={n.createdAt}
                  className="mt-1 block text-xs text-muted-foreground"
                />
              </div>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
