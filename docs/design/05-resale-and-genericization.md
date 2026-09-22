# Resale & genericization

## Status: confirmed future direction, not immediate work

Confirmed 2026-09-21: La Nube is generic enough (outside the landing page)
that it's a real candidate to eventually resell to other coworking spaces.
The model is **one isolated instance per tenant** (deploy-per-customer) —
**not** shared multi-tenancy inside one deployment. This doesn't
contradict [`00-overview.md`](./00-overview.md)'s non-goal ("not
multi-tenant... one deployment serves one institution") — it sharpens it:
that non-goal is about _this codebase's request-handling model_ (no
per-request tenant scoping, no cross-tenant data isolation to design, no
shared billing), which stays true. "Resellable" here means "installable
per customer," each with its own database, env vars, and deploy — not a
SaaS architecture change.

**The landing page is explicitly excluded** from this ambition — it stays
La Nube-specific (the quadruple-helix framing, its own visual identity).
A concrete consequence worth being honest about: **the landing page is
bespoke work for every new tenant**, not a themeable template. Deploy-per-
tenant resale doesn't mean self-serve white-labeling; it means each
install still needs a developer to rebuild that one page. Everything else
(reservations, events, forms, admin surfaces, and — once built — roles,
per `milestones-9-dynamic-roles.md`) is meant to be reusable as-is or with
config, not rebuilt.

## What's already generic

- `SiteConfig` — contact info as a superadmin-editable singleton row,
  already replacing what used to be a hardcoded constants file.
- `LandingTheme` — seasonal takeovers are admin-configured, not code.
- `Space` / `Resource` / `ReservationType` — a superadmin-managed catalog,
  not hardcoded per-space routes or types.
- Events, Forms, participant approval — a generic booking + registration
  engine with no La-Nube-specific assumptions baked in.
- Roles (once Milestone 9 ships) — per-install data, not a fixed enum.

## What isn't generic yet

- **Email templates hardcode "La Nube" and its specific sender domain**,
  not `SiteConfig`. Confirmed by grep: `src/lib/email/confirmation.ts`,
  `reset.ts`, `event-registration.ts`, `event-decision.ts`, and
  `event-occurrence-update.ts` all hardcode
  `FROM_EMAIL = "La Nube <no-responder@cdeluruguay.gob.ar>"` and
  "La Nube" in subjects/body copy. This is the single most concrete,
  cheapest-to-fix genericization gap identified so far — worth pulling
  the institution name (and ideally the from-address) from `SiteConfig`
  rather than a per-file constant, independent of when resale actually
  happens, since it also means today's one instance can't easily rebrand
  without a code change either.
- **UI strings are Spanish-only**, no i18n
  (`docs/foundations/language-and-copy.md`). Not necessarily a problem —
  if every prospective customer is also Spanish-speaking, this may never
  need to change — but it's a real open question, not a settled one (see
  below).
- **Per-tenant setup is entirely manual** today: new database, env vars,
  seed data (`u1-u30@lanube.local` pattern), and a bespoke landing page.
  There's no "new tenant checklist" doc, because there's only ever been
  one tenant. Not urgent to build (resale isn't imminent), but worth
  starting to keep a running list of "things a new install needs to
  change" as they're discovered, rather than reconstructing it from
  scratch whenever a second install actually happens.

## Relationship to the Rust migration

[`06-rust-migration.md`](./06-rust-migration.md) is what makes this
doc's deploy-per-tenant model concrete: the confirmed plan there splits
this repo into **backend (Rust) + management UI (Vite/React)** — the
sellable product — with the landing page moved to its own, separate,
per-customer repo instead of staying in this one at all. That's a
sharper version of "the landing page is bespoke work for every new
tenant" above: it's no longer just excluded from genericization, it's
excluded from this codebase entirely.

## Open questions

- Is Spanish-only UI a permanent choice, or does resale eventually require
  i18n? No customer has been named yet, so this doesn't need an answer
  now — but it's worth revisiting before, not during, an actual second
  deployment.
- Should the email-template hardcoding be fixed now (cheap, and benefits
  the current single instance too — rebranding today requires a code
  change) or deferred until resale is closer? Recommend fixing it
  opportunistically whenever those files are next touched, rather than as
  its own dedicated milestone.
