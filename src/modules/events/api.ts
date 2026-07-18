import {
  getPublicEventDetail,
  getUpcomingPublicEvents,
  getUpcomingPublicEventsPage,
} from "./db/events";

/**
 * Public, frontend-facing data API for the events module. This is the standardized
 * way any frontend (landing, custom pages) reads event data — call it via the
 * `modules.events` accessor (src/modules) rather than importing the db layer directly.
 *
 * Server-only: these functions touch the database. Use from Server Components,
 * route handlers, and server utilities.
 */
export const eventsApi = {
  /** Paginated upcoming published events (for grids/carousels). */
  getUpcoming: (page: number, pageSize: number) =>
    getUpcomingPublicEventsPage(page, pageSize),
  /** A flat list of upcoming published events, newest first. */
  listUpcoming: (limit?: number) => getUpcomingPublicEvents(limit),
  /** Full public detail for a single event, or null if not found/not public. */
  getDetail: (id: string) => getPublicEventDetail(id),
};

export type EventsApi = typeof eventsApi;
