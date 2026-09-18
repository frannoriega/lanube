# Milestone 3 — Seasonal / date-based landing themes

> **Decided scope (2026-09-18):** v1 ships for the 2026-09-25 anniversary with only
> two of the capabilities below — the **`EMOJI_SHOWER` entrance effect** and a
> **hero text override** (the headline/subheading area — see the reference
> screenshot the user provided: the existing hero's "La Nube — un espacio de
> `<keyword>`" treatment, overridden for the theme window). The activation-window
> and admin-configuration shape described below is confirmed as the right design —
> build it — but the **accent-preset swap and the top banner/ribbon are deferred**,
> not part of v1. See "v1 scope" under "What needs building".

## Use case

La Nube wants the public landing to visibly celebrate dates that matter to the
community — the coworking's anniversary (Sept 25), and potentially others (end-of-year
holidays, a future re-brand anniversary, etc.) — without a developer shipping a
one-off change each time. A visitor landing on the site on the anniversary should feel
something changed: the concrete idea on the table is a "tada" emoji shower
(🎉/🎊, varied sizes) on first visit that day, and optionally other visual/text
changes. Superadmin should be able to configure **which dates** trigger **which
theme**, without code changes, so this becomes a reusable capability rather than a
Sept-25-only hack.

## Current state

- No theming infrastructure exists. The landing (`src/app/(public)/page.tsx`) renders
  a fixed set of sections (`HeroSection`, `EventsSection`, `SpacesSection`,
  `MembersSection`, `PartnersSection`, `AlliesSection`); none read from a "current
  theme" concept.
- `HeroSection` (`src/components/templates/landing/hero/index.tsx`) is a client
  component with an existing rotating-keyword animation (typewriter effect over
  `keywords`) — the closest existing precedent for "small, contained animation
  hard-coded into the hero."
- `SiteConfig` (`prisma/models/site.prisma`) is the existing precedent for
  superadmin-editable public-facing configuration — but it's a **singleton** (one
  row, contact info only). A theme needs **multiple rows** (one per theme/date), so
  it's a new model, not an extension of `SiteConfig`.
- The design system (`DESIGN.md`) is deliberately constrained: a fixed two-hue palette
  (Observatory Blue / Signal Cyan), one bounded gradient-text usage, no side-stripe
  borders, glassmorphism confined to the nav. This matters directly for scoping
  what's configurable — see below.

## Design constraint: themes must stay inside the brand system, not outside it

This is the central design decision for this milestone, and it's why "let superadmin
theme anything" is the wrong shape for the configuration surface.

La Nube's brand identity is _specifically_ about restraint — one accent pair, one
bounded gradient rule, flat-by-default surfaces (see `DESIGN.md` "Named Rules" and
"Do's and Don'ts"). A generic "pick any color, any text, any effect" theme editor
would let a superadmin accidentally break the brand on the one day the most visitors
are likely to look closely (an anniversary). So: **themes should be a bounded set of
pre-built presets with a few safe, structured knobs — not free-form CSS/color input.**

Concretely, I'd scope what's configurable per theme to:

1. **Activation window** — when the theme is live. Two modes:
   - **Recurring annual** (`startMonthDay`/`endMonthDay`, e.g. `"09-25"` /
     `"09-25"` for a single day, or `"12-20"`–`"01-06"` spanning New Year's for a
     Christmas theme) — set once, fires every year without superadmin re-entry.
     This is what the anniversary and Christmas both want.
   - **One-off range** (fixed `startDate`/`endDate`) — for a non-recurring event
     (e.g. "10 years" is worth marking specially only once, or a one-time campaign).
   - If two themes' windows overlap, an explicit `priority` (integer) picks the
     winner — only one theme is ever active at a time, to avoid compounding effects.
2. **Entrance effect** — an enum of a small, developer-built set (not arbitrary):
   `NONE`, `EMOJI_SHOWER` (the concrete ask), reasonably `CONFETTI` later. Each
   effect type has its own bounded config:
   - `EMOJI_SHOWER`: which emoji (a short picklist, e.g. 🎉 🎊 🥳 — free text but
     capped at a handful of grapheme clusters, validated), particle count range,
     size range (small/medium/large mix, not arbitrary px), duration.
   - Trigger: "once per browser per day" (localStorage-gated, matching the ask —
     "first time you get into the page on the anniversary date") vs. "every load
     while the theme is active." Recommend defaulting to once-per-day.
3. **Hero micro-copy override** — optional short strings: a line above the H1 (e.g.
   "🎉 10 años de La Nube"), and/or a one-off addition to the rotating `keywords`
   list in `HeroSection`. Plain text only, same typography rules apply (no custom
   fonts/sizes/markup) — this is content, not a layout override.
4. **Accent swap (optional, from presets)** — rather than a color picker, a small
   number of developer-authored _named_ accent pairs (e.g. "Aniversario" = a warm
   gold paired with Observatory Blue; "Navidad" = a muted red/green pairing that
   still respects the "one accent pair at a time" rule) that superadmin can select
   per theme, applied only where the brand already allows an accent (the hero
   gradient word, badges) — never a full palette replacement.
5. **Optional top banner/ribbon** — a short dismissible line at the top of the
   public layout (reusing the existing glass-header precedent, since that's the
   one place glassmorphism is already sanctioned) with text + optional link, e.g.
   "🎉 Hoy celebramos 10 años — conocé nuestra historia."

Each of these is optional per theme — a theme can be "just the emoji shower," or
"just a banner," or all of the above. What's explicitly **out of scope** for
superadmin configuration: arbitrary CSS, arbitrary colors, arbitrary layout changes,
uploading new fonts. Those stay developer-authored (new presets ship as code) so the
system can't visually break the brand from the admin panel.

## What needs building

**v1 scope (this pass):** activation window + `EMOJI_SHOWER` effect + hero text
override, superadmin-configurable. **Deferred to a later pass:** accent-preset
swap, top banner/ribbon. The schema still has room for the deferred fields (so v2
doesn't need a breaking migration), but only the v1 fields get admin UI and
rendering now.

1. **Schema**: a new `LandingTheme` model — name, activation window (recurring vs.
   one-off + priority), `entranceEffect` (enum) + its bounded config (JSON, but
   validated against a per-effect Zod schema server-side, not free JSON), optional
   hero copy override fields (**v1**), optional accent-preset key (**schema only,
   no UI/rendering until v2**), optional banner text/link (**schema only, no
   UI/rendering until v2**), `isEnabled` toggle. Superadmin CRUD at
   `/admin/themes` (or folded into a "Landing" config section) — same pattern as
   `spaces-manager.tsx` / `reservation-types-manager.tsx`.
2. **Resolution logic**: a pure function (`resolveActiveTheme(themes, nowMs)`) that,
   given all enabled themes and the current date (admin-timezone, matching
   `ADMIN_TIMEZONE` elsewhere in the codebase), returns the single active theme (if
   any) by priority — unit-testable in isolation, same style as
   `src/lib/events/occurrences.ts`.
3. **Public rendering**:
   - Server-side: the landing page (or its layout) resolves the active theme at
     request time and passes it down — no client-side "guess the date" logic for
     which theme is active (avoids a flash of the wrong/no theme).
   - Client-side: a small client component owns the entrance effect (needs
     `window`/`localStorage` for the once-per-day gate) — e.g.
     `src/components/templates/landing/theme/emoji-shower.tsx` — mounted once near
     the root of the public layout, inert when no theme is active or the effect
     already played today.
   - Hero copy overrides flow into `HeroSection` as props rather than the
     component reaching for global state.
   - Accent preset and banner rendering are **deferred to v2** — not built now.
4. **Presets as code, config as data**: entrance-effect implementations and accent
   presets are components/constants shipped by a developer (e.g.
   `src/lib/constants/landing-themes.ts` for accent presets); the `LandingTheme`
   rows only select among them and supply the bounded fields above. This keeps the
   "no free-form CSS" rule enforceable in code, not just by convention.

## Implementation plan

1. Schema + migration for `LandingTheme` (v1 fields active; v2 fields present but
   unused); seed the anniversary (2026-09-25, recurring annual) row via the seed
   script or a data migration.
2. `resolveActiveTheme` pure function + unit tests (recurring window logic,
   year-boundary spanning, priority tie-breaking).
3. Build the `EMOJI_SHOWER` effect component first (the concrete ask); design its
   size/count/duration bounds so it reads as delightful, not spammy, on mobile too
   (test at ~400px width per the responsive floor).
4. Superadmin admin UI (`/admin/themes`): list + create/edit form, effect-specific
   sub-form (only show emoji-shower fields when that effect is selected), date
   window picker (reuse `DateRangePicker` for one-off; a lighter month-day picker
   for recurring).
5. Wire resolution into the public layout/landing page; add the hero copy
   override plumbing (banner deferred to v2).
6. Tests: `resolveActiveTheme` unit tests; a manual QA pass around the actual
   anniversary date (and the Dec 31 → Jan 1 boundary case for a Christmas-style
   theme) since date-window logic is exactly the kind of thing that's subtly wrong
   at the edges.

## Resolved (2026-09-18)

- **Sept 25 scope**: v1 is emoji shower + hero text override only. Accent presets
  and banner are v2, not blocking the anniversary date.
- **Configuration shape**: the bounded, preset-based approach above (activation
  window, effect enum with structured config, no free-form CSS/color) is confirmed
  as the right design.
- **Scope of "changing text and stuff"**: confirmed to mean the hero
  headline/subheading text (see the reference screenshot — the "La Nube — un
  espacio de `<keyword>`" treatment), not a broader visual swap (illustration,
  layout, etc.). Hero copy override is in scope for v1.

## Open questions (needs a product decision before/while building)

- **Effect trigger**: once-per-browser-per-day (localStorage) as proposed, or
  should it replay every visit while the theme is active? Once-per-day matches "the
  first time you get into the page," but a repeat visitor on the day might also
  enjoy seeing it again — worth confirming. Tracked in `docs/OPEN_QUESTIONS.md`.
- **Accent presets** (v2) and **banner** (v2): deferred, not blocking v1 — revisit
  when scheduled. Tracked in `docs/OPEN_QUESTIONS.md`.
