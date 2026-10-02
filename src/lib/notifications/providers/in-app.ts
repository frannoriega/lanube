import "server-only";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { serializeJson } from "@/lib/json-bigint";
import type { Prisma } from "@/generated/prisma/client";
import type { NotificationProvider } from "../provider";
import { renderInApp } from "../render/in-app";

/**
 * Writes one `Notification` row for the bell. Guests (recipients identified only by email,
 * e.g. an event participant with no account) have nothing to render a bell on, so this
 * provider silently skips them — the email provider is what reaches them instead.
 */
export const inAppProvider: NotificationProvider = {
  channel: "in-app",
  async send(event) {
    if (!("registeredUserId" in event.recipient)) return;
    const rendered = renderInApp(event);
    try {
      await prisma.notification.create({
        data: {
          recipientId: event.recipient.registeredUserId,
          type: event.type,
          title: rendered.title,
          body: rendered.body,
          data: rendered.data
            ? (serializeJson(rendered.data) as Prisma.InputJsonValue)
            : undefined,
        },
      });
    } catch (err) {
      logger.error("notifications/in-app", err, { type: event.type });
    }
  },
};
