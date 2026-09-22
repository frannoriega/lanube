# Rust migration

## Status: confirmed future direction, not scheduled

Confirmed 2026-09-21: long-term intent to move the **backend** off Next.js
API routes + Prisma onto a Rust service (one Cargo crate per clean-cut
feature, composed into an HTTP API), and off Vercel onto owned
infrastructure. Two decisions were made explicitly before this plan was
written, because they change the shape of everything below:

1. **Backend-only rewrite.** The authenticated management UI (dashboards,
   admin forms, calendars, dialogs) stays React/TypeScript — it is _not_
   rewritten in a Rust web framework (Leptos/Dioxus/Yew). It moves from
   Next.js to a plain Vite + React SPA (no SSR, no server runtime of its
   own) that talks to the new Rust API over HTTP/JSON. shadcn/Radix,
   react-hook-form + Zod, and nearly all existing component code carry
   over largely unchanged — see
   [Ports cleanly vs. needs redesign](#what-ports-cleanly-vs-what-needs-a-real-redesign)
   for the parts of the frontend that don't survive the move mechanically.
2. **The frontend also splits in two, permanently, not just for this
   migration.** The public marketing landing page moves **out of this
   repo into its own, separate repository**, staying React. It's treated
   as "La Nube's own bespoke site — customer #1," not part of what gets
   sold. This repo becomes just the **backend (Rust) + management UI
   (Vite/React)** — the sellable product — with no landing page in it at
   all. This sharpens
   [`05-resale-and-genericization.md`](./05-resale-and-genericization.md)'s
   already-confirmed exclusion of the landing page from the resale
   ambition: previously that meant "the landing page in this repo isn't
   genericized," now it means "the landing page isn't in this repo."

## Non-goals

- **Not an open-ended, indefinitely-drifting parallel rebuild.** The new
  stack is built against its own database while production keeps running
  unaffected, but the data migration is scripted and rehearsed, and
  cutover happens in one short, planned maintenance window — see
  [Data migration & cutover](#data-migration--cutover-revised-2026-09-21).
  Not a live, traffic-split strangler-fig migration (that approach was
  considered and superseded — see
  [Rejected alternatives](#rejected-alternatives)).
- **Not adopting a Rust UI framework.** Frontend stays React; only the
  bundler/server model changes (Next.js → Vite static SPA).
- **Not multi-tenant SaaS.** Still one isolated instance per customer
  (deploy-per-customer), per `05-resale-and-genericization.md` — this
  migration is what makes that model concrete, not a change to it.
- **Not scheduled work.** No milestone number, no target date. This is a
  standing plan to work from whenever the move actually starts, not a
  commitment to start it now.

## Target shape (end state)

Two repositories where there is one today — but landing reaches that end
state in two steps, not one (see
[Repo layout during the build](#repo-layout-during-the-build-confirmed-2026-09-22)
for why):

1. **This repo, eventually restructured down to just this** — a Cargo
   workspace (Rust backend, axum HTTP API, Postgres via `sqlx`) **plus**
   a Vite + React management-UI app, shipped/sold together as "the
   product." No landing page, in the end state.
2. **A new, separate `landing` repo, eventually** — La Nube's own public
   site (React, no server framework — see
   [Landing's frontend stack](#landings-frontend-stack-confirmed-2026-09-22)),
   decoupled from this repo's release cycle, consuming a set of
   **public, read-only, unauthenticated API endpoints** (news, upcoming
   events, reservation types, spaces, site config) that the backend
   exposes as an ordinary, versioned surface — not a private internal
   API. Confirmed 2026-09-21: this same surface is meant to be reused by
   **future customers' own landing pages** too, so it's designed as a
   real public contract (stable shape, documented, rate-limited via
   `lanube-ratelimit`) from the start, not as something bespoke to La
   Nube's landing that happens to be reachable.

**Confirmed 2026-09-22: the driver for moving landing off Next.js is
self-hosting, not aesthetics.** When this customer eventually moves to
owned infrastructure, that server needs to run the Rust API +
management UI + landing all together — keeping landing on Next.js would
mean operating a second, heavier server runtime (Node + Next's server)
alongside the Rust stack just for a marketing site, which is the exact
"overkill" this migration is otherwise removing. Landing becomes a
plain static-output build (Vite + React) that any static file server
(nginx/Caddy, same as everything else on that box) can serve — no
Node runtime in production at all, on this customer's server or Vercel.

## Repo layout during the build (confirmed 2026-09-22)

Confirmed: while landing is still being rebuilt, it lives **inside this
repo, in its own fully isolated top-level folder** — not entangled with
the Rust workspace or the management UI — specifically so extracting it
into its own repo later is a mechanical move, not an untangling
exercise.

```
/crates/           Rust workspace (lanube-db, lanube-auth, lanube-api, …)
/management-ui/    Vite + React SPA — the sellable product's frontend
/landing/          Vite + React static site — La Nube's own, extracted later
```

Rules that make the later extraction clean:

- **`landing/` is a complete, self-contained project on its own** — its
  own `package.json`, lockfile, `vite.config`, `tsconfig`, `node_modules`
  — not a workspace member sharing root-level tooling with
  `management-ui/`. It should be buildable/runnable by `cd landing &&
npm install && npm run dev` with zero awareness that a Rust workspace
  or another frontend happens to live in sibling folders.
- **No shared code between `landing/` and `management-ui/` — confirmed
  as a permanent policy, not a temporary one to revisit later.** Both
  happen to be Vite + React today, but that's treated as a
  **coincidence**, not a design commitment: duplicate small shared bits
  (brand colors, a primitive component) into each folder independently
  rather than importing across them. **The two staying visually/
  structurally identical is the exception, not the expectation** — if
  they drift apart over time (different component libraries, different
  conventions), that's an accepted, unsurprising outcome, not a problem
  to fix. This removes any temptation to introduce a shared package
  later "since they're so similar anyway" — they're not guaranteed to
  stay that way, by design.
- **Extraction mechanism, when the day actually comes**: `git subtree
split -P landing -b landing-extract` (or `git filter-repo --path
landing/`) to pull `landing/`'s own history out into a new repo,
  rather than a plain copy that discards history. Not rehearsed yet —
  see open questions.

## Landing's frontend stack (confirmed 2026-09-22)

**Vite + React, no meta-framework (Next.js or Astro) — matches the
management UI's stack, not a third stack to maintain.** Both
alternatives were considered and set aside for the same underlying
reason: this codebase already commits to Vite + React once for the
management UI, and adding a _second, different_ frontend framework
(Next.js kept just for landing, or Astro as something new) means a small
team maintaining two frontend toolchains instead of one, for a page that
doesn't need a meta-framework's capabilities (no SSR needed — content is
either static-at-build or fetched client-side from the public API, same
pattern the management UI already uses).

- **Next.js, rejected for landing specifically** — even though nothing
  forced this, keeping landing on Next.js was the "free" option only as
  long as it stays on Vercel. Since the actual goal is running landing
  alongside the Rust API + management UI on one owned server, Next.js's
  server runtime becomes exactly the operational weight this migration
  is otherwise shedding — not worth it just to keep `next/image` for
  free. See [Rejected alternatives](#rejected-alternatives).
- **Astro, considered, set aside in favor of stack consistency** — Astro
  would solve the image problem well too (see below), but it's a
  genuinely different framework (`.astro` files, its own component
  model, React only as islands) — a second toolchain next to the
  management UI's plain Vite + React, for a marketing site that doesn't
  need Astro's content-site-specific machinery. Revisit only if landing
  grows requirements Vite + React genuinely can't serve well.
- **Chosen: Vite + React + [`vite-imagetools`](https://github.com/JonasKruckenberg/vite-imagetools).**
  Confirming your read of it: yes — it's a Vite plugin, not a framework.
  It drops into the exact same Vite + React project landing already is
  (nothing new to learn framework-wise), and at build time turns an
  image import into a responsive `srcset`/`<picture>` source set
  (multiple sizes, AVIF/WebP with fallback), generated from the source
  image checked into `landing/`. This is what actually answers the
  viewport-sizing concern: mobile/tablet/desktop each get an
  appropriately-sized, appropriately-formatted image, computed once at
  build time, no runtime resizing service needed.

**Correction to the earlier framing — not every landing image is a
static build-time asset.** The original "static marketing assets" answer
was wrong to generalize: event photos (`Event.imageUrl`, uploaded by an
admin through the management UI, shown on landing's "Próximos eventos"
cards and each event's public `EventHero`) are dynamic, uploaded
content — not known at landing's build time, so `vite-imagetools` can't
touch them (it only processes images present in the repo at build time).
These are **already covered by the upload-time resize decision** for
`lanube-storage` (see
[Crate layout](#crate-layout-this-repo-backend-half)): the backend
generates a couple of fixed sizes when an admin uploads an event image,
and landing just picks whichever pre-generated variant fits its slot
(card thumbnail vs. hero), same as the management UI does — no separate
mechanism needed for this category, just reuse of what's already
decided. So, concretely: **`vite-imagetools` for landing's own checked-in
marketing assets; `lanube-storage`'s upload-time variants for anything
admin-uploaded and shown on landing.**

## Crate layout (this repo, backend half)

A Cargo workspace with one crate per feature area — this maps closely
onto the _existing_ `src/lib/db/*.ts` module boundaries, which is a real
head start: those modules are already organized as if crate boundaries
existed, just not compiler-enforced.

- **`lanube-db`** — Postgres pool (`sqlx`), migrations (hand-written
  `.sql`, replacing Prisma's), the BigInt-ms convention, and typed
  wrappers around the existing `CREATE OR REPLACE FUNCTION` business
  logic (`create_reservation`, `approve_reservation`,
  `get_unavailable_slots`, `get_user_next_reservations`,
  `get_actor_size`, `create_event_reservation`,
  `rebuild_reservation_ledger_forward`, etc.) — these move **unchanged**;
  Rust just calls them like any other Postgres client.
- **`lanube-auth`** — multi-method authentication (password, passkeys,
  OAuth, optional LDAP bind — see
  [Auth architecture](#auth-architecture-confirmed-2026-09-21)), session
  issuance + verification, RBAC (`Role`/permission catalog). Replaces
  NextAuth + `rbac.ts` + `api-auth.ts`/`page-auth.ts` — the crate with
  the least direct precedent to port from, since it's a redesign, not a
  port.
- **`lanube-reservations`** — reservations, ledger, spaces/resources/
  reservation-types CRUD; owns the public read-only endpoints landing/
  future customers consume.
- **`lanube-events`** — events, forms, participants, approval flow,
  session exceptions (cancel/reschedule); enqueues notification jobs
  (see [Background jobs & scheduling](#background-jobs--scheduling-confirmed-2026-09-21))
  rather than sending email itself.
- **`lanube-email`** — SMTP send (a `lettre`-based port of the
  Nodemailer templates); called by `lanube-worker`, not from request
  handlers — see below.
- **`lanube-jobs`** — the background-job abstraction: job type
  definitions, a Postgres-backed queue, retry/backoff policy — see
  [Background jobs & scheduling](#background-jobs--scheduling-confirmed-2026-09-21)
  for the hand-rolled-vs-`apalis` question.
- **`lanube-storage`** — port of the `StorageProvider` trait (`upload`/
  `remove`), extended to do an upload-time image resize/compress pass
  (via the `image` crate) — see
  [`next/image` replacement](#what-ports-cleanly-vs-what-needs-a-real-redesign).
- **`lanube-ratelimit`** — DB-backed rate limiting, already storage-
  agnostic logic, trivial port; also gates the new public read-only API.
- **`lanube-incidents`, `lanube-admin-stats`, `lanube-dashboard-stats`,
  …** — one crate per remaining `src/lib/db/*.ts` domain file.
- **`lanube-api`** (binary crate) — axum router composing every domain
  crate; owns HTTP concerns only (request parsing, response shaping,
  auth extractor, RBAC guard middleware, rate-limit middleware, OpenAPI
  schema generation for the new Vite frontend — and for landing/future
  customers' public surface — to consume).
- **`lanube-worker`** (binary crate) — the persistent background-
  execution process: drains `lanube-jobs`' queue (bulk participant
  emails, any other deferred work) and runs scheduled tasks (the
  `maintain-reservations` cron duty folds into this as just another job
  type) — see
  [Background jobs & scheduling](#background-jobs--scheduling-confirmed-2026-09-21).

**Boundary rule**: a domain crate may depend on `lanube-db` and other
domain crates only through their public types — never reach into another
crate's tables directly. This mirrors today's `src/lib/db/*.ts` file
boundaries, but the compiler enforces it instead of convention.

## Tech choices & rationale

- **axum over actix-web** — tower/tokio-native, simpler async story,
  fits "tight assurances, boring" better than actix's actor model.
- **`sqlx` over Diesel/SeaORM** — this codebase already treats
  hand-written SQL as the source of truth over its ORM's opinions (see
  `02-architecture.md`'s "Polymorphic `reservable_id`" trap and CLAUDE.md
  point 8 on `prisma migrate dev` hanging on this exact tension). A
  compile-time-checked raw-SQL layer (`sqlx::query!`/`query_as!`) matches
  that posture; a heavier ORM that wants to own the schema would fight it
  the same way Prisma already does. Migrations move to `sqlx migrate`
  (hand-written `.sql`, same spirit as today, no ORM-diffing step to
  fight at all).
- **BigInt-ms timestamps carry over as-is, and get strictly simpler.**
  Postgres `bigint` maps straight to Rust `i64` via `sqlx` — the
  JS-side problem this convention exists to work around (`Number` can't
  hold a full 64-bit ms timestamp) doesn't exist in Rust, so
  `prisma-auth-bridge.ts`'s whole Date↔BigInt conversion layer has no
  equivalent to port; there's simply one representation everywhere.
- **`jsonwebtoken`** for session tokens, **`webauthn-rs`** for passkeys,
  **`oauth2`** for the generic OAuth2/OIDC core, **`ldap3`** for LDAP bind
  — see [Auth architecture](#auth-architecture-confirmed-2026-09-21).
- **`lettre`** for SMTP send (keeps Mailpit for local dev, same as
  today), invoked only from `lanube-worker` — see
  [Background jobs & scheduling](#background-jobs--scheduling-confirmed-2026-09-21).
- **`image` crate** for server-side resize/compress at upload time — see
  the `next/image` discussion below.

## Auth architecture (confirmed 2026-09-21)

Confirmed direction, expanding on the original "just replace NextAuth"
framing: `lanube-auth` supports **multiple, additive credential types per
account**, not just email+password.

- **Methods**: password (as today), passkeys (WebAuthn via
  `webauthn-rs`), OAuth (a generic, provider-agnostic core via the
  `oauth2` crate — providers are configuration, not hardcoded
  integrations), and LDAP (**bind-only**: LDAP verifies credentials at
  login by binding as the user; `RegisteredUser` stays the Postgres
  source of truth for profile data, created on first successful LDAP
  login — no periodic directory sync, no LDAP-as-authoritative-attributes
  model, to avoid taking on sync/conflict/drift handling that bind-only
  doesn't need).
- **One account, many methods, additive**: a `RegisteredUser` can have any
  number of linked credentials (a password _and_ a passkey _and_ a Google
  identity, simultaneously) — any linked method signs them in. This
  replaces NextAuth's `Account` table (which modeled one row per _OAuth_
  link, not a general multi-method identity) rather than porting it;
  there's nothing to carry over 1:1 — see
  [Rejected alternatives](#rejected-alternatives) for the single-method
  option this ruled out.
- **Passkeys are never the only credential on an account — confirmed
  policy, not just a recommendation.** A passkey can only be _added_ to
  an account that already has a password or a linked OAuth identity;
  `lanube-auth` must refuse to remove the last non-passkey credential
  from an account (mirrors how GitHub/Google won't let you remove your
  only sign-in method). This is a straightforward server-side rule, no
  new mechanism required — it doesn't by itself need recovery codes to
  be safe.
- **Recovery codes — confirmed 2026-09-22, general safety net, not
  specifically a passkey feature.** Passkey-alone lockout is already
  prevented by the policy above, so recovery codes aren't solving that
  problem — they cover the adjacent case a password/OAuth-only policy
  doesn't: a user who's forgotten their password _and_ lost access to
  their recovery email at the same time. Confirmed: **8–10 single-use
  codes**, generated on request from account settings, shown once,
  stored hashed (same treatment as a password — never plaintext at
  rest), regenerable (regenerating invalidates the old set). A
  `lanube-auth` feature available to every account regardless of which
  methods it uses, not passkey-specific.
- **OAuth providers**: **Google and GitHub** are the first build/test
  targets for the generic core. Planned beyond that, roughly in
  priority order: **Microsoft** (covers both personal Outlook/Hotmail
  accounts _and_ work/school Entra ID accounts through one integration —
  genuinely useful synergy with the LDAP enterprise customers below,
  even for customers who don't run LDAP at all), **Apple**, **Yahoo**.
  **Facebook is explicitly deprioritized** per your call — not planned
  near-term. Flag on **Apple specifically**: "Sign in with Apple" isn't a
  clean OIDC provider like the others — its client "secret" is a
  self-signed JWT you generate and must rotate (max 6-month validity),
  and it returns the user's name only on the _first_ authorization ever,
  so that data has to be captured and persisted immediately or it's
  gone. Because the generic OAuth2/OIDC core is provider-agnostic by
  design, none of this should leak into `lanube-auth`'s core — it's an
  Apple-specific adapter's problem to solve, isolated the same way each
  provider's quirks should be. **Confirmed 2026-09-22: build order beyond
  Google/GitHub isn't a near-term concern** — this is far enough out that
  scheduling it now would be premature, and since each self-hosted
  customer (La Nube included) configures their own provider credentials
  (see below), a given customer only needs the providers _they_ actually
  want, not a fixed rollout order this project has to commit to.
- **LDAP + role assignment — confirmed independent, no auto-mapping.**
  LDAP is purely an **easy-login mechanism** (bind-only credential
  verification); app role assignment is a completely separate concern
  that doesn't read anything from LDAP. A brand-new LDAP-authenticated
  user gets the same base `USER` tier as any other new signup, promoted
  by hand through the admin UI exactly like today — no group→role
  mapping, now or as a near-term plan (a narrower bind-time
  group-membership read was proposed as an option and is explicitly
  **not** being built — see
  [Rejected alternatives](#rejected-alternatives)). This could change if
  a real customer need shows up later, but isn't designed for today.
- **Per-install, runtime-configurable, not deployment-time-only.**
  Refined 2026-09-22: which methods are enabled (LDAP on/off, which
  OAuth providers and their client credentials, whether passkeys are
  offered) needs to be **configurable by each self-hosted customer
  themselves**, not baked in at deploy time via env vars requiring a
  developer to redeploy. Concretely: a superadmin-only settings surface
  (backed by a `lanube-auth`-owned config table, not env vars) where an
  install's own admin enters their OAuth app's client ID/secret per
  provider, toggles LDAP with its connection details, etc. Client
  secrets stored this way need to be encrypted at rest (or at minimum as
  tightly permissioned as anything else superadmin-only), not stored
  plaintext just because they're in the database rather than an env
  file. Still per-install, not a runtime multi-tenant toggle — consistent
  with the deploy-per-customer resale model in
  [`05-resale-and-genericization.md`](./05-resale-and-genericization.md).

### Multi-credential schema (proposed 2026-09-22)

Proposal, not yet built — **separate, strongly-typed tables per
credential kind, linked by `user_id`, rather than one polymorphic table
with a JSONB blob.** This is standard practice for multi-method identity
systems (the shape Ory Kratos, Auth0, and most WebAuthn reference
implementations converge on), and it fits this codebase's already-chosen
`sqlx` raw-SQL-first posture much better than a generic blob column
would: each kind has a genuinely different, small, fixed set of fields,
so a typed table gets real foreign keys, uniqueness constraints, and
`sqlx::query_as!` compile-time checking, instead of runtime validation of
an opaque JSON shape.

- **`password_credentials`** — `user_id` (FK, unique — one password per
  account), `password_hash`, `created_at`, `updated_at`.
- **`passkey_credentials`** — `id`, `user_id` (FK), `credential_id`
  (the WebAuthn credential ID, unique), `public_key`, `sign_count`,
  `transports`, a user-supplied label (e.g. "MacBook Touch ID" — people
  with more than one passkey need to tell them apart), `created_at`,
  `last_used_at`.
- **`oauth_identities`** — `id`, `user_id` (FK), `provider`,
  `provider_user_id`, unique on `(provider, provider_user_id)`,
  `created_at`. Recommend **not** storing provider access/refresh
  tokens unless a concrete future feature needs to call that provider's
  API on the user's behalf (nothing today does) — this is sign-in-only,
  so there's no reason to hold onto more sensitive data than that.
- **`ldap_identities`** — `id`, `user_id` (FK), the LDAP `uid`/DN used to
  bind, `created_at`. No password material stored at all (bind-only), it
  exists purely so a repeat LDAP login re-matches the same `RegisteredUser`
  row instead of creating a new one each time.
- **`recovery_codes`** — `id`, `user_id` (FK), `code_hash`, `used_at`
  (nullable — set on redemption, making reuse a one-line check),
  `created_at`.

`users`/`RegisteredUser` itself carries **no auth-method columns at
all** — "does this user have a password" is answered by "does a row
exist in `password_credentials` for this `user_id`," which is exactly
what makes the "additive, any combination" model fall out naturally
instead of needing special-cased nullable columns per method.

**Enforcing "never passkey-alone"**: an application-level check at
credential-removal time in `lanube-auth` (would removing this row leave
only `passkey_credentials` rows for this user? refuse if so) is
sufficient — the only code path that can remove a credential is this
crate's own handler, so there's no other writer to defend against. A
database-level trigger enforcing the same rule is possible as
defense-in-depth but isn't necessary for a first version.

## Background jobs & scheduling (confirmed 2026-09-21)

Today's synchronous, in-request email sends
(`event-occurrence-update.ts`, `event-decision.ts` —
[memory: notifications-sync-limitation]) exist because Vercel functions
have a bounded request lifespan with no reliable way to keep working
after the response is sent. Moving off Vercel removes that constraint
outright, so this is being fixed as part of the migration, not carried
forward as a permanent limitation.

**Shape**: a Postgres-backed job queue (`lanube-jobs`) plus a persistent
worker process (`lanube-worker`) that idles on Postgres `LISTEN/NOTIFY`
(with a short poll as a fallback) when there's no work, and runs jobs
immediately when notified. **Confirmed: persistent-idle, not
spawn-per-job.** A worker sitting idle on a blocked async wait costs
effectively nothing (no CPU, minimal memory), and since its DB pool and
connections are already warm, a job starts executing with no cold start.
Spawning a fresh OS process per job would reintroduce the same class of
cold-start cost this migration is otherwise removing by leaving Vercel —
see [Rejected alternatives](#rejected-alternatives).

- **Enqueue inside the same DB transaction as the triggering write**, so
  a job for a change is never enqueued if that change rolls back — the
  same "notify only after commit" guarantee the current sync code
  achieves by ordering, `lanube-jobs` achieves by putting the enqueue
  inside the transaction itself.
- **Cron folds in as a job type.** `maintain-reservations`'s daily run
  becomes a scheduled entry the same worker processes, rather than a
  separate mechanism — one background-execution model instead of two.
- **Bulk notifications: one job per recipient, confirmed 2026-09-22 —
  not one job for the whole batch.** When an event session change
  triggers notifying every non-cancelled participant, `lanube-events`
  enqueues **N individual jobs** (one per participant) rather than a
  single job holding the full recipient list. This is what makes
  **per-recipient retry** fall out for free from the queue crate's
  ordinary per-job retry behavior, instead of needing bespoke
  partial-retry logic inside one big job: if recipient #12 of 40 fails,
  only that job retries/dead-letters — the other 39 are already separate,
  already-succeeded jobs, untouched. This was the actual motivation for
  rejecting whole-batch retry — see
  [Rejected alternatives](#rejected-alternatives).
- **Dead-lettered jobs are visible to superadmin only — confirmed
  2026-09-22, needs a new permission.** Consistent with this codebase's
  existing precedent that operational/system-level visibility (the audit
  trail, per `milestones-2-audit-trail.md`) belongs to the superadmin/
  owner tier, not the `ADMIN` employee role. Needs a new permission-
  catalog entry (name TBD, e.g. `jobs:view-failures`) granted only to
  `SUPERADMIN`, and a small admin-UI surface to list/inspect
  dead-lettered jobs — not designed in detail yet, see open questions.
- **No new infrastructure dependency.** Postgres is already required by
  every other crate; a dedicated broker (Redis, RabbitMQ) isn't needed at
  this scale and would be a new operational dependency for the "our own
  server" deployment target to own.
- **Queue implementation — researched 2026-09-27, real Rust crates exist
  for this now**, so hand-rolling isn't the default recommendation
  anymore. Candidates, closest fit first:
  - **`underway`** ([crates.io](https://crates.io/crates/underway),
    [GitHub](https://github.com/maxcountryman/underway)) — a `sqlx`-based
    Postgres job/workflow library whose stated design matches this doc's
    requirements almost exactly: jobs enqueue **inside your own
    transaction** (the exact "enqueue only if the write commits"
    guarantee above), `FOR UPDATE SKIP LOCKED` task claiming, built-in
    retry strategies, and **built-in cron-style scheduling** — which
    would fold `maintain-reservations` in directly rather than needing a
    hand-rolled scheduler on top of a plain queue. Also supports
    multi-step durable workflows, which nothing here needs yet but costs
    nothing to have available. **Leading candidate** on fit; worth
    checking its maturity/release history before committing, since it's
    a newer, smaller-community crate than an ORM-scale dependency would
    be — the low job volume here makes that an acceptable risk, but pin
    the version.
  - **`pgboss`** ([docs.rs](https://docs.rs/pgboss/latest/pgboss/),
    [GitHub](https://github.com/rustworthy/pgboss-rs)) — a Rust port of
    the Node.js `pg-boss` you originally asked about (yes, it exists as
    a native crate, not just a library to draw inspiration from).
    Feature set is a close match: retries, delayed/scheduled jobs,
    dead-letter handling, priority, singleton/deduplicated jobs, archive
    retention — and it's explicitly "compatible with and partially
    ported from" `pg-boss`'s schema/semantics, useful if that mental
    model (or prior `pg-boss` experience) is worth optimizing for.
    Currently pre-1.0 (`0.1.0-rc5` as of this writing) — flag the same
    maturity caveat as `underway`.
  - **`apalis` + `apalis-postgres`** ([apalis.dev](https://apalis.dev/))
    — the more general-purpose option: backend-agnostic (Postgres,
    Redis, SQLite, in-memory), integrates with axum/tokio, has a
    `PostgresStorageWithListener` variant built specifically around
    Postgres `LISTEN`/`NOTIFY` for low-latency dispatch — the same idle-
    until-notified model already decided above. Worth it if the job
    surface is expected to grow into something needing a broader
    middleware/observability ecosystem; more general (and so less
    tailored) than `underway` for what's needed today.
  - **Hand-rolled table + `SKIP LOCKED` polling** — demoted from "leaning
    this way" to **fallback only**, now that purpose-built crates exist
    that already do this correctly (job-queue correctness under
    concurrent workers has real edge cases — visibility timeouts, retry
    backoff jitter, exactly-once claiming — worth not re-deriving by
    hand when a maintained crate already has). Reconsider only if none
    of the above prove production-ready enough when this is actually
    built.
    Not fully decided — see open questions. Recommend spiking `underway`
    first given the fit, with `pgboss` as the fallback comparison.
- Retry/backoff policy and dead-letter handling (what happens if a bulk
  email batch job fails partway through) aren't designed yet — see open
  questions.

## Data migration & cutover (revised 2026-09-25)

**Supersedes the originally-confirmed strangler-fig/shared-database
plan** — see [Rejected alternatives](#rejected-alternatives) for why.
Revised direction, confirmed: given genuinely low current traffic, a
short, scripted maintenance window is an acceptable and much simpler
alternative to a live, traffic-split migration against a shared
database.

**Shape**:

1. **Build the full Rust backend + Vite management UI against a fresh,
   separate Postgres instance**, entirely independent of production —
   production (Next.js + its own Postgres) keeps running unaffected for
   as long as the build takes. Internally, still build/test in vertical
   slices (public read endpoints → auth → admin CRUD → reservations →
   events/forms/participants → jobs/email/storage) for sanity, but this
   is now purely a _development_ ordering — nothing here is exposed to
   real users until cutover, so there's no "phase" of live traffic to
   coordinate.
2. **Write and rehearse a scripted data migration**: dump production
   Postgres, transform into the new schema, load into the new instance.
   Most tables are structurally close to unchanged (reservations,
   events, forms, participants, etc. — the SQL business-logic functions
   carry over as-is per [Crate layout](#crate-layout-this-repo-backend-half)),
   so that part is close to mechanical. Auth data needs real
   transformation: existing bcrypt password hashes carry over as-is
   (bcrypt is a standard format, not a NextAuth-specific one) into the
   new password-credential rows; NextAuth's `Account`/`VerificationToken`
   rows don't map onto anything (no OAuth identities exist yet to
   migrate, and stale verification tokens don't need to survive a
   migration).

   **Rehearsal method, confirmed 2026-09-22**: run the migration script
   against an **empty new Postgres instance with the full Rust app
   running against it**, repeatedly, while production (Next.js + its own
   Postgres) keeps serving real traffic completely untouched — the
   rehearsal never reads from or writes to the live database, only a
   dump/copy of it. Repeat until the script runs cleanly and the Rust
   app behaves correctly against the migrated copy. **Only once that's
   solid** does the real maintenance window happen — at that point the
   script is a known quantity being re-run against real data for the
   first time, not being debugged live. This is what makes step 3 short
   by construction: nothing in the maintenance window is a first attempt.

3. **Cutover, in one maintenance window**: put the current app into a
   read-only/maintenance mode (block writes — new reservations,
   registrations, everything), run the rehearsed migration script
   against real production data, verify (row counts, spot checks,
   ideally an automated diff of a few representative tables), point the
   new Rust API + Vite frontend at the new Postgres instance, flip
   DNS/reverse-proxy routing, bring the new app up, and only then
   decommission the old one.
4. **Rollback plan**: keep the old app and its Postgres instance intact
   (not deleted) for some period after cutover — since only the _new_
   database was written to during migration, the old one is untouched
   and the "undo" path is just flipping routing back, no data recovery
   needed.

This also resolves what used to be the "auth cutover" concern under the
old plan: since the whole app flips atomically in one maintenance window
rather than auth moving ahead of everything else, there's no window
where NextAuth-issued and Rust-issued sessions need to coexist. Confirmed:
**every user simply logs in again** on the new app after cutover — no
session-compatibility mechanism needed.

## What ports cleanly vs. what needs a real redesign

**Ports cleanly (low risk, mechanical translation):**

- All SQL business logic (every `CREATE OR REPLACE FUNCTION`) — unchanged.
- BigInt-ms timestamps — see above, actually gets _simpler_.
- The three-layer RBAC enforcement concept (middleware / API / page) —
  middleware layer becomes an axum `tower` layer, API layer becomes an
  extractor; the _page_ layer disappears entirely once pages move to the
  frontend SPA (nothing server-side left to gate a page render).
- DB-backed rate limiting — already storage-shaped logic.
- The `StorageProvider` trait — already trait-shaped in TS.
- Domain crate boundaries — `src/lib/db/*.ts` already drew these lines.
- `react-markdown`/`remark-gfm` rendering, react-hook-form + Zod forms,
  shadcn/Radix components — all frontend-only, unaffected by the backend
  swap, and survive the Next.js → Vite move basically as-is (Vite has no
  opinion about component code, only about routing/bundling/SSR, none of
  which this app's components depend on for their own logic).
- Existing password hashes (bcrypt) — carry over into the new
  multi-credential schema unchanged; bcrypt is a standard format, not
  NextAuth-specific.

**Needs a real redesign (flag explicitly, budget real time):**

- **Auth/session model is the single largest net-new engineering surface
  in this whole migration, and it just got bigger by design, not by
  accident.** This isn't a port of NextAuth's Credentials-only setup —
  see [Auth architecture](#auth-architecture-confirmed-2026-09-21) for
  the confirmed multi-method (password/passkey/OAuth/LDAP) scope,
  including recovery codes and per-provider quirks like Apple's. Needs,
  from scratch: session issuance/verification, cookie flags
  (`httpOnly`/`sameSite`/`secure`) set by hand instead of by a library,
  CSRF protection (NextAuth handles this implicitly for Credentials
  sign-in; axum does not), email-verification/password-reset token
  flows, WebAuthn registration/assertion ceremonies, an OAuth2/OIDC
  redirect+callback flow per provider, an LDAP bind client, and recovery
  codes. Budget this as a genuinely large, multi-method identity system,
  not a NextAuth swap-in.
- **Server Components / Server Actions have no Rust-side equivalent, and
  this is bigger than it sounds even under "backend-only" scope.** Every
  page that fetches data server-side or calls a Server Action needs its
  data access rewritten as an explicit client-side fetch to a JSON
  endpoint once the frontend becomes a Vite SPA. This touches nearly
  every page in the app. **Budget the Next.js → Vite frontend
  restructuring as comparable in size to the backend rewrite** — "backend
  only" bounds _what stack the UI is written in_, it does not bound how
  much of the existing frontend code's data-fetching plumbing needs to
  change.
- **`next/image` replacement — resolved, split by app.** Management UI:
  upload-time resize in `lanube-storage` (`image` crate, one or two fixed
  sizes, plain `<img>` with explicit `width`/`height` + `loading="lazy"`)
  — this surface really is small and admin-controlled, that reasoning
  holds. Landing: **confirmed** Vite + React + `vite-imagetools` for
  checked-in marketing assets, plus reuse of `lanube-storage`'s
  upload-time variants for admin-uploaded content (event images) shown
  on landing — see
  [Landing's frontend stack](#landings-frontend-stack-confirmed-2026-09-22)
  for the full reasoning and the correction to the original
  "everything's a static asset" framing.
- **File uploads (`multipart/form-data`)** need an axum-side
  implementation — Next.js's route handlers did this implicitly;
  axum needs an explicit multipart extractor wired to `lanube-storage`.
- **Deployment target is Unix, but the specific distribution isn't
  decided** (Ubuntu vs. a RHEL-family distro like CentOS/Rocky/Alma —
  see open questions). Beyond the OS choice, moving off Vercel means
  owning, from scratch: a process supervisor (systemd unit or a
  container orchestrator), TLS termination, deploy automation (Vercel
  gives zero-downtime deploys for free today), log aggregation (today
  it's just Vercel's dashboard), and secrets management (today Vercel
  env vars). None of this blocks _starting_ the Rust build — it can be
  developed entirely before a deployment target is finalized, since
  cutover only happens once, in the scripted maintenance window above —
  but it's real, separate work, not something that "falls out" once the
  code happens to be in Rust.
- **Testing.** Vitest unit tests on pure functions (`identity.test.ts`,
  `admin-timezone.test.ts`, `admin-timeline.test.ts`) need direct Rust
  unit-test ports of the same logic, straightforward. Anything that
  exercises a Next.js API route needs new axum integration tests (e.g.
  `tower::ServiceExt::oneshot` or a real test server + `reqwest`) written
  from scratch, not translated line-for-line.

## Open questions

_(also tracked in [`../OPEN_QUESTIONS.md`](../OPEN_QUESTIONS.md#rust-migration))_

- **Deployment target distro** — Ubuntu vs. a RHEL-family distro
  (CentOS/Rocky/Alma); confirmed Unix, not narrowed further yet.
- **Job queue implementation** — `underway` (leading candidate: matches
  transactional-enqueue + cron requirements closely), `pgboss` (closer
  `pg-boss` parity, pre-1.0), or `apalis`/`apalis-postgres` (broader
  ecosystem, `LISTEN`/`NOTIFY` support built in) — see
  [Background jobs & scheduling](#background-jobs--scheduling-confirmed-2026-09-21).
  Recommend spiking `underway` first. Not fully decided.
- **Repo-extraction mechanics for `landing/`** — `git subtree split` vs.
  `git filter-repo`, and when to actually rehearse pulling `landing/` out
  into a standalone repo (before or only once the real move happens).
  Not rehearsed yet.
- **Exact dead-letter-visibility permission name and surface** —
  confirmed superadmin-only (see
  [Background jobs & scheduling](#background-jobs--scheduling-confirmed-2026-09-21)),
  but the permission catalog entry and admin-UI surface for reviewing
  dead-lettered jobs isn't designed yet.
- **Rollback retention window** — how long to keep the old app + old
  Postgres instance alive after cutover before fully decommissioning;
  the rehearsal _method_ itself is now confirmed (see
  [Data migration & cutover](#data-migration--cutover-revised-2026-09-25)),
  this is just the retention duration, treated as an operational call
  made nearer the actual cutover rather than a design decision now.

## Rejected alternatives

- **Strangler-fig, incremental migration against a shared, live
  database** — this was the originally-confirmed migration strategy
  (routing production traffic to Rust one route at a time, both stacks
  reading/writing the same Postgres instance throughout). **Superseded
  2026-09-25**: given genuinely low current traffic, the coordination
  overhead of a live, traffic-split migration (dual-session handling,
  route-by-route reverse-proxy rules, keeping two backends simultaneously
  correct against one schema for an extended period) isn't worth it
  compared to a scripted, rehearsed, short maintenance window. Recorded
  here rather than silently overwritten, per this repo's docs workflow —
  the original reasoning (spreading risk across independently-verifiable
  phases) was sound in general, it just weighed differently once "how
  much live traffic is actually at risk" was factored in honestly.
- **Rewriting the management UI in a Rust web framework** (Leptos/
  Dioxus/Yew) — rejected; confirmed backend-only scope. The existing
  React/shadcn/Radix/react-hook-form investment stays, just repointed at
  a Vite build instead of Next.js.
- **SeaORM/Diesel as the database layer** — rejected in favor of `sqlx`'s
  raw-SQL-first model, for consistency with this codebase's existing
  posture of treating hand-written SQL as authoritative over an ORM's
  opinions (see `02-architecture.md`).
- **Keeping the landing page in this repo, just genericized/themeable**
  — rejected; the landing page moves to its own repo entirely rather
  than becoming a configurable part of the sellable product. It stays
  bespoke, per-customer, hand-built — see
  [`05-resale-and-genericization.md`](./05-resale-and-genericization.md).
- **One auth method per account** — rejected in favor of additive
  multi-method accounts; a single-method model would be simpler to build
  but is worse UX (can't add a passkey without giving up your password)
  and specifically awkward for the LDAP case, where a customer's
  LDAP-authenticated staff couldn't also register a passkey.
- **LDAP directory sync** (periodically syncing attributes/roles from
  LDAP into `RegisteredUser`, LDAP treated as authoritative) — rejected
  in favor of bind-only auth: sync brings conflict handling and drift
  risk that bind-only doesn't need.
- **LDAP group→role auto-mapping** (a narrower alternative to full
  directory sync: reading only the authenticating user's own group
  membership at their own login, to auto-assign a role) — proposed, then
  **rejected 2026-09-22**: LDAP is scoped to authentication only; app
  role assignment stays fully independent and manual (same promote-by-
  hand flow as any other signup method), not driven by LDAP group data
  at all, even via this narrower mechanism. Revisit only if a real
  customer need for it shows up.
- **Whole-batch retry for bulk-notification jobs** (one job per
  triggering event, containing the full recipient list, retried as a
  unit on any failure) — rejected in favor of **one job per recipient**:
  retrying a whole batch would re-send email to recipients who already
  succeeded, which is worse than the sync-send status quo this migration
  is trying to improve on. See
  [Background jobs & scheduling](#background-jobs--scheduling-confirmed-2026-09-21).
- **Ephemeral spawn-per-job workers** — rejected in favor of a
  persistent, idle `lanube-worker` process. Spawning a fresh OS process
  per job matches "workers that appear only when needed" literally, but
  reintroduces real cold-start cost (process spawn, DB pool init, TLS
  handshake) per job — the same class of problem this migration is
  otherwise removing by leaving Vercel, just self-hosted instead. A
  worker idling on `LISTEN/NOTIFY` costs effectively nothing at rest, so
  the efficiency goal is met without the cold-start cost.
- **An external job broker (Redis, RabbitMQ, etc.)** — rejected in favor
  of a Postgres-backed queue; Postgres is already a required dependency
  for every other crate, and job volume at this scale doesn't justify a
  second piece of infrastructure for the "our own server" deployment
  target to operate.
- **Keeping landing on Next.js/Vercel indefinitely** — this was the
  earlier recommendation ("least new work"), reversed 2026-09-22 once
  the actual goal was stated clearly: landing needs to run alongside the
  Rust API + management UI on this customer's own server eventually.
  Node + Next's server runtime is exactly the operational overkill this
  migration removes elsewhere; keeping it just for landing's convenience
  isn't worth it. See
  [Landing's frontend stack](#landings-frontend-stack-confirmed-2026-09-22).
- **Astro for landing** — rejected in favor of matching the management
  UI's plain Vite + React stack. Astro would solve the image problem
  well too, but it's a second, different frontend framework for a small
  team to maintain (its own component model, React only as islands) for
  a page that doesn't need Astro's content-site-specific machinery once
  `vite-imagetools` covers the actual image-responsiveness need.
- **Sharing components/code between `landing/` and `management-ui/`** —
  rejected in favor of small duplication; a cross-folder import between
  the two would undermine the entire point of keeping `landing/`
  isolated for later extraction. See
  [Repo layout during the build](#repo-layout-during-the-build-confirmed-2026-09-22).
- **Requiring recovery codes to make a passkey-only account safe** —
  rejected as the mechanism for that specific problem; solved instead by
  a simpler server-side policy (passkeys can't be an account's only
  credential at all). Recovery codes are still recommended, but as a
  general safety net available to every account, not as passkey-specific
  scaffolding.

## Cross-links

- [`05-resale-and-genericization.md`](./05-resale-and-genericization.md)
  — this migration is what makes that doc's "deploy-per-tenant" model
  concrete: after the split, "install for a new customer" becomes
  "deploy this repo's backend + management-ui; the customer's landing
  page is a separate, bespoke concern, same as La Nube's own," and the
  new public read-only API is designed for exactly that reuse.
- [`02-architecture.md`](./02-architecture.md) — its stack section
  describes the _current_ Next.js/Prisma/Vercel state; it needs a rewrite
  once the Rust build is actually underway, not before. Until then, this
  doc states the target, `02-architecture.md` states the present.
- [`00-overview.md`](./00-overview.md) — non-goals section, for how this
  plan relates to the existing "not multi-tenant" / resale framing.
- [`../OPEN_QUESTIONS.md`](../OPEN_QUESTIONS.md#rust-migration) — open
  questions listed above, tracked there too per this repo's convention.
