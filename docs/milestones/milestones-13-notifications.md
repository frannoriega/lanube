# Milestone 13 — Abstract notification system

## Use case

Right now every "tell someone something happened" path in lanube is its own
hand-rolled nodemailer call, living inside the feature that triggered it
(`src/lib/email/confirmation.ts`, `reset.ts`, `event-registration.ts`,
`event-decision.ts`, `event-occurrence-update.ts`). Each one re-declares its
own transporter, its own `FROM_EMAIL`, its own inline-HTML shell. There is no
in-app notification at all — a user only learns their reservation was
approved by checking the dashboard, and the one place this was tried
(Noticias decision emails) got ripped back out during milestone-12 specifically
because it was ad-hoc, feature-local code (see `[[feedback-no-unrequested-features]]`
in the operator's memory, and the "possible unintentional loss" note left in
`src/lib/email/news-decision.ts`'s removal commit).

The ask: a core notification concept — an event with a recipient and a
payload — dispatched through **pluggable channels** (in-app today; email
folded into the same abstraction instead of staying separate; SMS/WhatsApp/push
later, with no changes to any call site). A call site never talks to a
channel directly; it builds an event and calls one function.

Two event types were named explicitly as the must-haves:

1. **Reservation approved / rejected**, with the space, type, time window,
   and (for a rejection) the reason.
2. **Event session changed** (cancelled / rescheduled / restored) for
   participants, carrying the event name, the original and new windows, and
   the reason.

Plus "fill in a reasonable `etc.`, or nothing if these two are enough." One
more was added, because it's a clean fit and literally the exact gap
milestone-12 flagged as a probable mistake:

3. **Noticia decision**, for the post's author — a submission approved/rejected,
   or (milestone-12's pedido/decisión cycle) a pending EDIT/PAUSE/DELETE
   request against a live post approved/rejected, with the reason if given.

Participant registration-decision emails (`event-decision.ts`) and the
registration confirmation (`event-registration.ts`) were **not** folded into
this system in this pass — see [Not done in this pass](#not-done-in-this-pass).

## Design

### The one seam: `NotificationProvider`

```ts
// src/lib/notifications/provider.ts
export interface NotificationProvider {
  readonly channel: string; // "in-app" | "email" | …
  send(event: NotificationEvent): Promise<void>;
}
```

A provider decides for itself whether it has anything to do with a given
event (by calling into its own renderer) and whether it can reach the
recipient. It never throws for an expected "nothing to do" case — only for a
genuine failure, which the dispatcher isolates per-provider.

### The event vocabulary: `NotificationEvent`

A closed, typed union in `src/lib/notifications/types.ts` — adding an event
type means adding a case there plus a case in each renderer, nothing else.
Pure data (no `server-only` import), so it's safe to describe from a client
component if that's ever needed (e.g. an admin preview).

```ts
export type NotificationRecipient =
  | { registeredUserId: string }
  | { email: string }; // a guest with no account — email-only by construction

export type NotificationEvent =
  | { type: "reservation.approved"; recipient; data: ReservationDecidedData }
  | { type: "reservation.rejected"; recipient; data: ReservationDecidedData }
  | { type: "event.sessionChanged"; recipient; data: EventSessionChangedData }
  | { type: "news.decided"; recipient; data: NewsDecidedData };
```

The recipient union is the mechanism that makes email-only guests (an event
participant who registered without an account) fall out naturally: the
in-app provider only ever handles `{ registeredUserId }` (silently skips a
bare `{ email }` — there's no bell to ring for someone with no account), and
the email provider handles both, resolving a `registeredUserId` to an address
via the DB when needed.

### The dispatcher: `notify()`

```ts
// src/lib/notifications/dispatch.ts
const PROVIDERS: readonly NotificationProvider[] = [
  inAppProvider,
  emailProvider,
];

export async function notify(event: NotificationEvent): Promise<void> {
  // Promise.allSettled over PROVIDERS.map(p => p.send(event)); logs, never throws.
}
```

This is the one function call sites use. **Never throws** — same principle
as `recordAudit`: a broken notification pipe must not fail the mutation that
triggered it. A provider that fails is logged individually (with its channel
name and the event type); the others still run. Adding SMS/WhatsApp/push
later is a new file in `./providers/` plus one line in `PROVIDERS` — no call
site changes.

### Renderers

Each channel has its own renderer module (`./render/in-app.ts`,
`./render/email.ts`) — a pure `(event) => RenderedForThatChannel | null`
function, switched on `event.type`. Pure functions on purpose: trivially
unit-testable without touching Prisma or nodemailer (see
`render/in-app.test.ts`, `render/email.test.ts`). `null` means "this event
type has nothing to say on this channel" — used by `event.sessionChanged`'s
email renderer (see below).

`render/format.ts` holds the one shared date-formatting helper
(`formatMoment`/`formatRange`, Spanish, `ADMIN_TIMEZONE`), so every renderer
produces the same "jueves 23 de julio, 10:00" style text instead of each
reinventing it.

### In-app channel → `Notification` model

One row per (event, recipient) pair, already rendered (title/body are plain
text, never re-derived from `data` by the UI):

```prisma
model Notification {
  id          String
  recipientId String          // → RegisteredUser, onDelete: Cascade
  type        String          // e.g. "reservation.approved" — not an enum,
                               // same reasoning as AuditLog.action
  title       String
  body        String
  data        Json?           // deep-linking payload, e.g. { reservationId }
  readAt      BigInt?
  createdAt   BigInt
}
```

`src/lib/db/notifications.ts` exposes `listNotificationsForUser` (most recent
20 + total unread count) and `markNotificationsRead` (all, or a given id
set). Two routes under `/api/user/notifications` (GET the list, POST to mark
read) — gated by `requireActiveSession()` only, since these are always
"my own notifications," no admin permission involved.

### Email channel

One shared transporter + `FROM_EMAIL` constant in
`src/lib/notifications/providers/email.ts` — the first time this repo has
**one** place to change SMTP config for a new notification type, instead of
copy-pasting the `nodemailer.createTransport({...})` block each ad-hoc
sender currently repeats.

**`event.sessionChanged`'s email renderer returns `null` on purpose.** The
existing `notifyEventParticipantsBatch` (`src/lib/email/event-occurrence-update.ts`)
already sends **one email per participant covering every change from a
single save** (a cancel + a reschedule in the same edit → one email, not
two) — this per-event renderer can't reproduce that batching without
re-introducing it elsewhere. So that call site keeps its bespoke batched
email exactly as it was, and **additionally** calls `notify()` once per
(participant-with-an-account, change) for the in-app channel only — the
email renderer's `null` means the email provider is a safe no-op for that
call, so there's no risk of double-emailing. A participant with no account
(registered via the public form, no `userId`) still gets the existing email
and simply has nothing to ring a bell on.

### UI: the bell

`src/components/molecules/notification-bell.tsx` — a `Bell` icon button in
the shared management header (`ManagementLayout`, so it appears for both the
user and admin shells with zero per-page wiring), with a small dot while
`unreadCount > 0`. Clicking it opens a popover listing the 20 most recent
notifications (title, body, local timestamp) and marks them all read.
Polls `/api/user/notifications` every 60s via `useApi`'s `refreshIntervalMs`
so the dot can appear without a manual reload — no WebSocket/SSE for v1 (see
[Open questions](#open-questions)).

## Call sites wired in this pass

- `PATCH /api/admin/reservations/[id]` — `reservation.approved` on approval,
  `reservation.rejected` on an explicit rejection **and** on every
  auto-rejected conflict from an approval's cascade (the same people who get
  an `reservation.auto-reject` audit entry now also get told). Only
  single-owner (`reservableType === "USER"`) reservations get a recipient —
  a TEAM/ORG/EVENT reservation has no one person to notify; silently skipped
  for v1 (see [Open questions](#open-questions)).
- `src/lib/email/event-occurrence-update.ts` (`notifyEventParticipantsBatch`)
  — additionally calls `notify()` once per change for any participant with a
  linked account, as described above.
- `POST /api/admin/news/[id]/decision` — `news.decided` to the post's
  author (`post.authorId`), covering both an initial-submission decision and
  a decision on a pending EDIT/PAUSE/DELETE request. Skipped when the author
  was deleted (`authorId` is `SetNull`, not restored).

## Not done in this pass

- **`event-decision.ts` (participant registration approved/rejected) and
  `event-registration.ts` (registration confirmation) were left as their own
  ad-hoc senders**, not migrated onto this system. They're guest-facing by
  nature (most participants have no account) and already do their one job
  correctly; folding them in would be a pure refactor with no new behavior,
  better done as its own small cleanup once the system has a second real
  consumer to validate the abstraction against.
- **No preference/opt-out model.** Every event currently fires on every
  configured channel unconditionally. A "don't email me, in-app is enough"
  setting is real future scope, not built here.
- **No background queue.** Like every other synchronous email sender in this
  codebase, `notify()` runs inside the request that triggers it. Fine at
  current scale; the existing `TODO(scale)` note on `notifyEventParticipantsBatch`
  already covers event-session fan-out, and the same caveat now applies to
  every `notify()` call site. See [Open questions](#open-questions) for the
  scaling path.

## Open questions

- **TEAM/ORG/EVENT reservation notifications.** Who's "the recipient" for a
  reservation booked by a team? All members? Just the booker (if that's ever
  tracked)? Left unanswered; those reservation kinds get no notification
  today, same as before this milestone (they never had one).
- **Realtime vs. polling.** A 60s poll is simple and consistent with this
  codebase's other "cheap polling, no infra" patterns (`ServerTimeProvider`),
  but means up to a minute of lag before the dot appears. If that's ever not
  good enough, Vercel now supports WebSockets on Functions
  (`experimental_upgradeWebSocket()`) without leaving the Node runtime — a
  real option when it's worth the complexity, not needed for v1.
- **Scale path for `notify()`.** At current traffic, synchronous fan-out
  inside the request is fine (same reasoning as the existing
  `TODO(scale)` notes). If/when that stops being true, Vercel Queues
  (`@vercel/queue`, GA) is the natural next step — swap `notify()`'s body to
  enqueue instead of dispatching inline, with the providers unchanged. Not
  built now; flagged so the seam is where anyone would expect it.
- **Deep-linking from a notification.** `Notification.data` already carries
  enough to build a link (`reservationId`, `eventId`, `slug`, …), but the
  bell UI doesn't render one yet — notifications are read-only today. A
  follow-up, not blocking.
