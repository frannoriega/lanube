import "server-only";
import { logger } from "@/lib/logger";
import type { NotificationEvent } from "./types";
import type { NotificationProvider } from "./provider";
import { inAppProvider } from "./providers/in-app";
import { emailProvider } from "./providers/email";

/**
 * The plug point for the whole system: add, remove, or reorder channels here. A future SMS
 * or WhatsApp provider is a new file in ./providers/ plus one line in this array — nothing
 * else in the codebase changes, including every call site that already calls `notify()`.
 */
const PROVIDERS: readonly NotificationProvider[] = [
  inAppProvider,
  emailProvider,
];

/**
 * Fans one event out to every configured channel, in parallel. Never throws — same
 * principle as `recordAudit`: a broken notification pipe must not fail the mutation that
 * triggered it. A provider that fails is logged individually; the others still run.
 */
export async function notify(event: NotificationEvent): Promise<void> {
  const results = await Promise.allSettled(
    PROVIDERS.map((provider) => provider.send(event)),
  );
  results.forEach((result, i) => {
    if (result.status === "rejected") {
      logger.error("notifications/dispatch", result.reason, {
        channel: PROVIDERS[i].channel,
        type: event.type,
      });
    }
  });
}
