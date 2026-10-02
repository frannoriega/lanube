import type { NotificationEvent } from "./types";

/**
 * The one seam the whole system is built around: a channel knows how to turn an event into
 * something it can deliver, and nothing else — not where the event came from, not who else
 * is also being notified. Adding SMS/WhatsApp/push later means writing one of these plus a
 * renderer in ./render/*, and listing it in ./dispatch.ts's PROVIDERS array.
 */
export interface NotificationProvider {
  /** Short id for logs — "in-app", "email", "sms", … */
  readonly channel: string;
  /**
   * Deliver (or silently skip) one event. Must not throw for an expected "nothing to do"
   * case (e.g. no renderer for this event type, or no address to deliver to) — return
   * instead. `dispatch.ts` already isolates a genuine failure per provider, so this only
   * needs to reject for something actually unexpected.
   */
  send(event: NotificationEvent): Promise<void>;
}
