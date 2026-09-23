# Milestone 10 — Frontend audit: error handling, accessibility/contrast, security hardening

> **Status (2026-09-23): all six slices implemented** on branch `milestone-10`
> (branched from `milestone-9`, itself from `preview`), except the two items
> explicitly held back below. This document remains the record of the audit run on
> **2026-09-23** against branch `milestone-5` (at `34a91be`) — findings, evidence and
> reasoning are preserved as written; the implementation notes are additive.
>
> | Slice | Commit    | State                                                    |
> | ----- | --------- | -------------------------------------------------------- |
> | A     | `22c640e` | Done, + a regression test that reads the tokens from CSS |
> | B     | `fb522d1` | Done                                                     |
> | C     | `bc84ce7` | Done **except the CSP nonce** (step 5) — see below       |
> | D     | `e3a2728` | Done; auth pages deferred as a design pass — see below   |
> | E     | `9364b87` | Done, including the keyboard booking path                |
> | F     | `8e29d77` | Done                                                     |
>
> Verified by `npm run build` (all 76 routes compile), `npx tsc --noEmit`, `eslint`,
> and 178 passing tests; the admin surfaces and public pages were smoke-tested against
> the running dev stack.
>
> ### Open questions, as resolved
>
> 1. **Incidents — finish or hide? (F1.6)** Neither, quite: the nav entry turned out to
>    already be gone — it lived only in `organisms/layouts/admin-layout.tsx`, which has
>    **zero imports** anywhere (the live shell is `templates/management`). That file and
>    its sibling `user-layout.tsx` were deleted as dead code. `/admin/incidents` is
>    reachable only by URL, and now says plainly that the service does not exist yet
>    instead of rendering a working-looking screen over a 501. Finishing it stays its own
>    milestone.
> 2. **Calendar keyboard booking (F2.5 step 3).** Built as **option (a)** — the doc's own
>    recommendation ("far cheaper and probably better for touch too"): a "Reservar" button
>    per day column opening the existing dialog with a default one-hour slot. The dialog
>    was already keyboard-operable; only _opening_ it required a mouse. This was a
>    Level A failure with no workaround, so shipping the recommended option beat leaving
>    it open — but it is a visible UI addition and worth a look before merge.
> 3. **CSP nonce (slice C step 5) — NOT DONE, deliberately.** Everything else in slice C
>    shipped and is verified live. `'unsafe-inline'` remains in `script-src`; removing it
>    needs a middleware-generated nonce, and the audit's own reasoning (a wrong nonce
>    blanks the app, and `npm run build` will not catch it) argues for shipping it alone
>    after a preview walkthrough of every route group. It could not be verified that way
>    from here.
> 4. **How far does the token change reach (slice A)?** `--muted-foreground` went
>    `#888282` → `#666666` (3.78 → 5.74:1 on `--card`; 3.06 → 4.66:1 on `--background`).
>    That is a deliberate visual change across ~220 usages and still wants an eyeball
>    before merge; the measured ratios are now asserted in `src/lib/contrast.test.ts`.
> 5. **Is `reservation-timeline-legacy.tsx` dead?** Yes — zero imports, verified. Deleted
>    rather than fixed, taking 53 palette literals with it.
>
> ### Deliberately not done
>
> - **The CSP nonce** (above).
> - **The auth pages' dark mode.** `signin` / `reset` / `signup` (~60 literals) are
>   wrapped in `ThemeProvider` but contain **not one** `dark:` class, so in dark mode they
>   render light-theme colors throughout. That is a design pass, not the mechanical sweep
>   slice D performed on the admin surfaces, and it is tracked in `OPEN_QUESTIONS.md`.
> - **The remaining 11 hand-rolled routes.** The 14 with _no_ `try`/`catch` were the real
>   finding and are fixed; the rest already log and differ only in response shape.
>
> ### A wrong turn worth recording
>
> The first pass at slice D's literal sweep matched `hover:bg-gray-50` and appended a
> **resting-state** `dark:bg-gray-900` to sidebar items that already carried
> `dark:hover:bg-gray-700` — silently changing their default background. It was reverted
> and redone under a strict rule: plain string `className`s only, and only utilities with
> no variant prefix. Anyone extending the sweep to the auth pages should keep that rule.
>
> Per `docs/milestones/README.md`, a milestone is "one coherent piece of
> user-facing capability." This one is deliberately an exception: it is a
> **quality milestone**, not a feature. It is grouped as one because the three
> audited axes share a single root cause in two places — the design-token
> layer (`globals.css`) and the client fetch layer — and fixing them
> separately would mean touching the same files three times.

## Why this audit was run

Requested directly: "do a full audit of the frontend. Look for (1) error
handling — printing stack traces, missing try/catch; (2) accessibility,
especially around contrast in both light and dark mode; (3) security issues."

No specific incident triggered it. It is a proactive sweep before the app is
exposed to a wider public audience (the landing, `/forms/[slug]` public
registration and `/noticias` are all unauthenticated surfaces).

## Method

Static analysis of `src/` only — **no browser session was run**, so every
finding below is read off the source and, for contrast, computed rather than
observed. Specifically:

- **Error handling:** enumerated every `fetch(` call site in `*.tsx`, every
  `route.ts` under `src/app/api`, and checked each for an enclosing
  `try`/`catch` and for whether the failure reaches the user.
- **Contrast:** extracted the token values from `src/app/globals.css` and
  computed WCAG 2.1 relative-luminance contrast ratios with a script
  (OKLCH → linear sRGB → luminance → ratio), including alpha compositing for
  the `/50`-opacity focus ring. The script is reproduced in the appendix so
  the numbers can be re-derived rather than trusted.
- **Security:** reviewed `next.config.ts` headers, `src/middleware.ts`,
  `dangerouslySetInnerHTML` sites, `target="_blank"` sites, `NEXT_PUBLIC_*`
  usage, client-side storage, and the markdown render path.

**What this method cannot see, and what therefore is NOT covered:** real
rendered contrast where a translucent `glass-*` utility sits over a
photographic background; actual screen-reader output; real keyboard tab
order; focus trapping in Radix portals; and any runtime-only error. A
follow-up pass with axe-core in a browser is listed as deferred work.

---

## Part 1 — Error handling

### What is already good (do not "fix" these)

Worth stating explicitly, because the audit's job is partly to confirm the
existing conventions hold:

- **`src/lib/api/response.ts` is correct and well-documented.** `apiError` /
  `apiServerError` / `apiCatch` enforce that the client only ever sees a
  controlled `{ message }`. `apiServerError` logs server-side and returns a
  generic `"Error interno del servidor"`. This matches the standing
  convention in memory (`api-error-logging-conventions`).
- **`src/lib/logger.ts` never leaks.** `describeError()` captures `err.stack`
  but it is written to `console.error` only; the stack is never in a response
  body. The comment there says as much and it is accurate.
- **There is exactly one `console.*` call in the whole `*.tsx` tree** —
  `src/app/(management)/auth/signin/page.tsx:121`, a deliberate
  `console.error("[signin] signIn() failed", err)` next to a user-facing
  toast. That is fine and should stay.
- **No stack trace is rendered to a user anywhere.** The original concern
  ("printing stack traces") does not reproduce. Every `data.message` / `err.message`
  surfaced in a toast (14 sites) is the _server's_ controlled message from the
  API envelope, not a JS `Error.message`. The one exception is F1.3 below.
- **`src/hooks/use-api.ts` handles failure properly** — it normalizes a
  non-`ApiError` throw into `new ApiError(0, null, "Error de red")` and keeps
  stale data while refetching. The hook is not the problem; its _callers_ are
  (F1.2).

### F1.1 — No error boundaries anywhere in the App Router _(High)_

`find src/app -name 'error.tsx' -o -name 'global-error.tsx'` returns **nothing**.
The only special file present is `src/app/not-found.tsx`.

There are 7 layouts (`src/app/layout.tsx`, `(public)`, `(management)/auth`,
`(management)/user`, `(management)/admin`, `(management)/banned`, `forms`) and
none of them has a sibling `error.tsx`.

Consequences:

- A throw in any **server** component (e.g. a Prisma call in
  `/admin/reports/page.tsx` when the DB is unreachable) falls through to
  Next's built-in error page. In production Next redacts the stack, so this is
  _not_ a stack-trace leak — but the user gets an unbranded, Spanish-less
  Next.js page with no way back into the app.
- A throw during **client** render (e.g. a `null` field in a calendar
  occurrence) unmounts the entire route and shows
  `"Application error: a client-side exception has occurred"`. There is no
  retry, and the user loses whatever they were doing.

The `forms/` route group is the worst place for this: it is the public,
unauthenticated event-registration surface, reached by people who have never
seen the app. A raw Next error page there is the whole first impression.

There are also **no `loading.tsx` files**, so no route streams a skeleton;
every server page blocks on its data before anything paints.

### F1.2 — `useApi` callers silently discard `error`, so a failed GET renders as an empty state _(High)_

There are 12 `useApi` call sites. Only three destructure `error`
(`admin/users/page.tsx:137`, `admin/reports/page.tsx:184`,
`WeekCalendar.tsx:261`). The other nine do not:

| File                                                   | Line     | Destructured               |
| ------------------------------------------------------ | -------- | -------------------------- |
| `organisms/admin/config/spaces-manager.tsx`            | 50       | `data, firstTime, refetch` |
| `organisms/admin/config/resources-manager.tsx`         | 55       | `data, firstTime, refetch` |
| `organisms/admin/config/reservation-types-manager.tsx` | 55       | `data, firstTime, refetch` |
| `organisms/admin/config/site-config-manager.tsx`       | 120      | `data, firstTime`          |
| `organisms/admin/event-form.tsx`                       | 163, 167 | `data` only (×2)           |
| `organisms/admin/form-template-builder.tsx`            | 410      | `data, firstTime`          |

Because `useApi` keeps `data: null` on failure and flips `loading` to
`false`, every one of these renders its **empty state** on an error. A
superadmin whose `/api/admin/spaces` request 500s or 403s sees "no hay
espacios" — i.e. _the data looks deleted_. On the config pages that is the
most alarming possible wrong message.

`event-form.tsx` is the sharpest case: a failed `/api/admin/resources` fetch
gives an empty resource `<Select>`, so the admin concludes there are no
resources rather than that the page failed to load.

**Decision taken while auditing:** the fix belongs in the _callers_, not in
`useApi`. Making the hook throw (to be caught by an `error.tsx`) would take
down the whole page for a secondary widget's failure — `event-form`'s two
`useApi` calls are exactly that. An inline "no se pudieron cargar los
recursos — reintentar" block per caller is the right granularity.

### F1.3 — `magic-link` surfaces a raw JS error string to the user _(Medium)_

`src/app/(management)/auth/magic-link/page.tsx:52-65`:

```ts
if (!response.ok) {
  const errorData = await response.json();          // ← no .catch()
  throw new Error(errorData.message || "Error al validar el enlace");
}
// ...
} catch (error: unknown) {
  const knownError = error as Error;
  setError(knownError.message || "Error al validar el enlace");
}
```

`response.json()` has no `.catch(() => ({}))` — unlike every other call site
in the codebase, which all use that guard. If the endpoint answers with
anything non-JSON (a proxy 502, an HTML error page, an empty 500 body), the
`SyntaxError` is thrown _inside_ the `try`, caught by the generic handler,
and its message is rendered into the page. The user sees
`Unexpected token '<', "<!DOCTYPE "... is not valid JSON`.

This is the only place in the frontend where an internal error string reaches
a user. Severity is Medium rather than High because it discloses nothing
sensitive — but it is exactly the class the audit was asked to find.

Same file, same block: `catch (error: unknown) { const knownError = error as Error }`
is an unchecked cast — a thrown non-`Error` (possible from a rejected fetch in
some runtimes) makes `.message` `undefined`, which the `||` then covers. Not a
bug today, but the cast should be an `instanceof` narrow.

### F1.4 — Four submit handlers have no `try`/`catch` around `fetch` _(Medium)_

| File                                | Handler            | Line |
| ----------------------------------- | ------------------ | ---- |
| `(management)/auth/signin/page.tsx` | `onRegisterSubmit` | 127  |
| `(management)/auth/signin/page.tsx` | `onResetSubmit`    | 151  |
| `(management)/auth/reset/page.tsx`  | `onSubmit`         | 41   |
| `organisms/forms/public-form.tsx`   | `onSubmit`         | 157  |

Each checks `res.ok` but nothing wraps the `await fetch(...)` itself. `fetch`
rejects on network failure (offline, DNS, aborted connection) _before_
producing a response, so on a dropped connection the promise rejects inside
react-hook-form's `handleSubmit`. RHF resets `isSubmitting` in a `finally` and
re-throws, so the observable result is: **the button re-enables and absolutely
nothing else happens** — no toast, no message. The user retries into the same
silence.

`public-form.tsx` is again the worst instance: it is the public registration
form, used from phones on whatever connection, and the failure mode is a
person believing they registered when they did not. `handleCancel` in the same
file (line ~188) has `try`/`finally` but **no `catch`**, so the same silent
failure applies to cancelling a registration.

Note these four are also the only client `fetch` calls that bypass
`apiSend` from `src/lib/api/client.ts` for a mutation, which is why they lack
the `ApiError` handling the rest of the app gets for free. Two of them
(`signin`, `reset`) additionally omit the `Content-Type: application/json`
header; that works today because Next's `req.json()` doesn't require it, but
it's an inconsistency worth closing in the same pass.

### F1.5 — 27 of 58 API routes bypass the response helpers; several have no `try`/`catch` at all _(Medium)_

31 of 58 `route.ts` files import `apiCatch`/`apiServerError`/`apiError`/`apiSuccess`.
The other 27 hand-roll `NextResponse.json(...)`:

```
src/app/api/spaces/route.ts                     src/app/api/admin/forms/route.ts
src/app/api/events/route.ts                     src/app/api/admin/resources/route.ts
src/app/api/reservation-types/route.ts          src/app/api/admin/resources/[id]/route.ts
src/app/api/forms/[slug]/route.ts               src/app/api/admin/reservation-types/route.ts
src/app/api/forms/[slug]/upload/route.ts        src/app/api/admin/reservation-types/[id]/route.ts
src/app/api/forms/response/[token]/route.ts     src/app/api/admin/incidents/route.ts
src/app/api/forms/response/[token]/upload/…     src/app/api/admin/incidents/[id]/route.ts
src/app/api/auth/magic-link/route.ts            src/app/api/admin/spaces/reorder/route.ts
src/app/api/auth/reset/route.ts                 src/app/api/admin/users/[id]/route.ts
src/app/api/auth/register/route.ts              src/app/api/admin/events/[id]/participants/route.ts
src/app/api/auth/confirm-email/route.ts         src/app/api/admin/events/[id]/participants/file/route.ts
src/app/api/auth/[...nextauth]/route.ts         src/app/api/user/events/route.ts
src/app/api/cron/report-snapshot/route.ts       src/app/api/dev/server-time/route.ts
src/app/api/cron/maintain-reservations/route.ts
```

**The messages themselves are safe** — a grep for `message: err.message`,
`error: e.`, `String(err)` in `src/app/api` returns nothing. So this is not a
leak. The two real problems are:

1. **Unlogged failures.** `src/app/api/forms/response/[token]/route.ts` (GET,
   PUT, DELETE) has no `try`/`catch` whatsoever. A Prisma error there produces
   Next's default 500 and **never reaches `logger.error`**, so in production
   it is invisible in the Vercel log stream. This is the public
   registration-edit endpoint — the one whose failures we'd most want to see.
2. **Drift.** Two error shapes coexist, and the client
   (`ApiError` in `src/lib/api/client.ts`) already has to read _both_
   `{ message }` and `{ error }` to cope. That compatibility shim is a symptom
   worth removing.

`src/app/api/auth/[...nextauth]/route.ts` is correctly on this list and should
be _excluded_ from any fix — it is NextAuth's own handler.

### F1.6 — The admin Incidents feature is wired to a 501 stub _(High — broken feature)_

Found incidentally while auditing error handling, but it is a real user-facing
break, so it is recorded here.

`src/app/api/admin/incidents/route.ts` is a stub:

```ts
export async function GET() {
  return NextResponse.json(
    { message: "Servicio no implementado" },
    { status: 501 },
  );
}
// export async function GET() {
//   try { ... }     ← the entire real implementation, commented out
```

Meanwhile `src/app/(management)/admin/incidents/page.tsx` is a **complete UI**:
it lists incidents, has a create dialog, and an update handler, each with
proper `try`/`catch` + toast (lines 60-83). Every one of those calls hits the 501. The admin sees "Error al crear el incidente" with no explanation, and the
list renders permanently empty.

So the page is shipped-but-dead. Two viable resolutions, and this needs a
product call (see Open questions):

- **(a)** Finish the route — the commented-out body is right there and the
  `Incident`/`IncidentUser` models exist in the schema.
- **(b)** Hide the nav entry and the page behind a flag until it is real.

Doing neither is the current state and is the worst of the three.

### F1.7 — Dead, misleading optimistic session write in signup _(Low — NOT a vulnerability)_

`src/app/(management)/auth/signup/page.tsx:95-104`: when the profile POST
**fails**, the handler calls `update({ ...session, user: { ..., signedUp: true } })`
before showing the error toast — i.e. it marks the user as having completed
signup precisely when the server said they had not.

This _reads_ like a client-side gate bypass, and the audit initially flagged
it as one. **It is not.** `src/lib/auth.ts`'s `jwt` callback takes only
`{ token }` — it ignores NextAuth's `trigger`/`session` arguments entirely and
recomputes `token.signedUp` from the database on every invocation (lines
109-138). So `update()` round-trips to the server and the DB value wins;
`middleware.ts`, which reads `token.signedUp`, is never fooled.

Recording it anyway because (i) the next person to read it will reach the same
wrong conclusion, and (ii) the safety depends on an implementation detail of
the `jwt` callback that nothing documents or tests. Delete the call and add a
comment to the `jwt` callback saying it deliberately ignores client-supplied
session updates.

---

## Part 2 — Accessibility

### F2.1 — The focus indicator is invisible in light mode, app-wide _(Critical)_

This is the single most consequential finding in the audit.

`src/components/ui/button.tsx:8` and `input.tsx:12` (and by extension every
shadcn control) style focus as:

```
focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]
```

and `globals.css:173` adds `* { @apply border-border outline-ring/50; }`.

But `globals.css:119` sets `--ring: #c8f1fc` in light mode — the pale
`la-nube-accent` cyan. Computed ratios:

| Focus ring                       | Against                | Ratio      | Needs (SC 1.4.11) |
| -------------------------------- | ---------------------- | ---------- | ----------------- |
| `--ring` #c8f1fc, full opacity   | `--background` #e2e8f0 | **1.02:1** | 3:1               |
| `--ring` #c8f1fc, full opacity   | `--card` white         | **1.20:1** | 3:1               |
| `ring-ring/50` (composited)      | `--background`         | **1.01:1** | 3:1               |
| `ring-ring/50` (composited)      | `--card` white         | **1.10:1** | 3:1               |
| `--ring` dark `oklch(0.556 0 0)` | dark `--background`    | 3.77:1     | 3:1 ✓             |
| `ring-ring/50` dark (composited) | dark `--background`    | **1.86:1** | 3:1               |

In light mode the ring is _mathematically indistinguishable_ from the page.
A keyboard-only user cannot tell which control is focused, anywhere in the
app — sign-in, the booking calendar, the admin config forms. That is WCAG
2.4.7 (Focus Visible, Level AA) and 2.4.11 (Focus Appearance) failed outright,
plus 1.4.11 (Non-text Contrast).

Dark mode nearly passes at full opacity and fails once the `/50` is applied.

Root cause: `--ring` was set to a **brand tint** rather than to a
focus-indicator color. The two have opposite requirements — a brand tint wants
to recede, a focus ring must not. The fix is a dedicated `--ring` per theme
chosen for contrast (`la-nube-selected` #2a6297 gives 5.18:1 on the light
background, and is already the established "text" brand color — see F2.3), and
dropping the `/50` opacity so the token's measured ratio is the delivered one.

### F2.2 — `--muted-foreground` fails AA in light mode; ~220 usages _(High)_

`globals.css:113` sets light `--muted-foreground: #888282`.

| Ratio      | Context                                |
| ---------- | -------------------------------------- |
| **3.06:1** | on `--background` #e2e8f0              |
| **3.78:1** | on `--card` white                      |
| 6.91:1     | dark mode, on dark `--card` — **fine** |

AA needs 4.5:1 for normal text. `text-muted-foreground` appears **220 times**
across `src/`, and it is by convention the class for secondary text: helper
text under form fields, timestamps, the registration-window note on event
cards, table meta, empty-state copy. All of it is below AA in light mode and
comfortably above it in dark mode.

The asymmetry is the tell: dark mode's value is the stock shadcn
`oklch(0.708 0 0)`, while light mode's was hand-overridden to `#888282`. The
override is the regression. Light mode needs roughly `#6b6b6b` or darker to
clear 4.5:1 against white _and_ against the `#e2e8f0` page background.

### F2.3 — `text-la-nube-primary` fails AA as a text color _(Medium)_

`--color-la-nube-primary: #4e87c2` measures **3.06:1** on the light background
and **3.77:1** for white-on-primary — both short of 4.5:1.

The codebase already has the correct pattern and uses it in ~20 places:

```tsx
className = "text-la-nube-selected dark:text-la-nube-secondary";
```

`#2a6297` (selected) on light = **5.18:1** ✓; `#75e3f1` (secondary) on dark =
**11.91:1** ✓. That pairing is right and should become the only sanctioned way
to render brand-colored text.

The violations are the sites that use `primary` _as text or as a text
background_ instead:

- `admin/users/page.tsx:273, 294` — `text-la-nube-primary`, including a
  `text-3xl font-semibold` stat (large text, so 3:1 applies — 3.06 scrapes by,
  but the 6×6 icon next to it is non-text at 3.06 and also marginal)
- `admin/reports/page.tsx:215`
- `(public)/about/page.tsx:314, 316, 318` — `<b className="font-semibold text-la-nube-primary">`
  inside body copy; normal-size text at 3.06:1
- `(public)/spaces/page.tsx:121` — `bg-la-nube-primary … text-white font-bold`, 3.77:1
- `WeekCalendar.tsx:838` — see F2.5

Uses of `la-nube-primary` as a **border, spinner, icon-accent or gradient
stop** (the majority of the 60+ hits) are not text and mostly fine; they
should be left alone.

### F2.4 — `bg-clip-text` gradient headings are near-invisible at their light end _(High)_

The landing sections and `/about` render their headline noun as a gradient:

```tsx
// templates/landing/partners/index.tsx:32, and ~8 sibling sections
<span className="bg-linear-to-r from-la-nube-primary to-la-nube-secondary bg-clip-text text-transparent">
  socios
</span>
```

Against the light page background:

- gradient **start** `#4e87c2` → **3.06:1**
- gradient **end** `#75e3f1` → **1.22:1**

These are `text-5xl` headings, so the large-text threshold of 3:1 applies —
the start scrapes past it and the end fails by a factor of ~2.5. In practice
the last third of every landing headline fades into the page.

This affects `landing/{partners,allies,members,news,events,spaces}/index.tsx`,
`landing/hero/index.tsx`, and `(public)/about/page.tsx:125`, plus the same
sections' `even:bg-la-nube-accent/40` band, which raises the background
luminance slightly and makes it marginally worse.

Note the _same_ sections get the eyebrow label right
(`text-la-nube-selected dark:text-la-nube-secondary`, 5.18:1) — so the fix is
to re-anchor the gradient to the same pair: `from-la-nube-selected to-la-nube-primary`
in light, `from-la-nube-primary to-la-nube-secondary` in dark.

### F2.5 — `WeekCalendar` is mouse-only and color-coded _(Critical)_

`src/components/organisms/calendar/WeekCalendar.tsx` (1206 lines) is the
primary booking surface at `/user/spaces/[slug]`. Three separate failures:

**(a) Creating a reservation is impossible without a mouse.** Lines 772-778:
the day column is a `<div>` with `onMouseDown` / `onMouseMove` and a
drag-to-select interaction. There is no `onKeyDown`, no `tabIndex`, no
`role`, and no touch handler. Keyboard users have no path to book at all
(WCAG 2.1.1 Keyboard, Level A). Touch users depend on the browser's mouse-event
emulation, which does not reliably produce a drag-select.

**(b) Reservation cards are not reachable or announced.** Lines 841-850: each
occurrence is a `<div onClick={() => setSelectedOccurrence(occ)}>` with
`cursor-pointer` and a `title=` attribute — no `role="button"`, no `tabIndex={0}`,
no key handler. Screen readers announce it as static text; keyboard users
cannot open the detail dialog (which is where cancel, including the new
milestone-5 per-occurrence cancel, lives). The `title` tooltip carrying
"(Tu reserva) (Pendiente)" is unavailable to both touch and keyboard.

**(c) Status is conveyed by color plus low-contrast white text.** Lines 827-838
map status to a background, with `text-white text-xs` on top:

| Class                        | Status          | White-on-bg ratio | Verdict    |
| ---------------------------- | --------------- | ----------------- | ---------- |
| `bg-yellow-500` #eab308      | own + PENDING   | **1.92:1**        | unreadable |
| `bg-green-600` #16a34a       | own + approved  | **3.30:1**        | fails AA   |
| `bg-la-nube-primary` #4e87c2 | someone else's  | **3.77:1**        | fails AA   |
| `bg-red-600` #dc2626         | own + REJECTED  | 4.83:1            | ✓          |
| `bg-gray-500`                | own + CANCELLED | 4.84:1            | ✓          |

The `text-[10px] … opacity-90` time line (line 861) sits below even these.
`bg-yellow-500` with white text at `text-xs` is the worst contrast pair in the
codebase.

There is partial mitigation for "color as the only cue" — `✓` / `✗` / `⏳`
glyphs are appended (lines 852-870) — but they are bare emoji with no text
alternative, so they read as "check mark button" or nothing at all.

This is the highest-effort item in the milestone and the one most likely to
need its own design pass.

### F2.6 — Status badges are duplicated four times and none is theme-aware _(Medium)_

`src/components/atoms/status-badge.tsx` hardcodes a light-only palette:

```tsx
case "APPROVED": return <Badge className="bg-green-100 text-green-800">Aprobada</Badge>;
case "REJECTED": return <Badge className="bg-red-100 text-red-800">Rechazada</Badge>;
case "PENDING":  return <Badge className="bg-yellow-100 text-yellow-800">Pendiente</Badge>;
case "CANCELLED":return <Badge className="bg-gray-100 text-gray-800">Cancelada</Badge>;
```

No `dark:` variant on any branch. The _internal_ contrast is fine (green-800
on green-100 ≈ 6.2:1), so this is not a text-contrast failure — it is that in
dark mode these render as bright pastel chips on a near-black card, which
both looks broken and destroys the surrounding visual hierarchy.

The same pattern is copy-pasted, also without `dark:`, in:

- `app/(management)/admin/users/columns.tsx:42, 47` (`Activo` / banned)
- `app/(management)/admin/incidents/page.tsx:91, 93, 95, 97`
- `app/(management)/admin/checkin/page.tsx:288, 294`

Four independent status→color maps for overlapping concepts. Consolidating
them into one theme-aware `StatusBadge` with a variant prop is both the
accessibility fix and a real deduplication.

### F2.7 — 786 hardcoded palette literals bypass the token system _(Medium — root cause of F2.6)_

Counting `(bg|text|border)-<palette>-<shade>` occurrences in `*.tsx`: **786**.
Worst offenders:

| Count | File                                              |
| ----- | ------------------------------------------------- |
| 79    | `templates/admin/report/index.tsx`                |
| 53    | `organisms/admin/reservation-timeline-legacy.tsx` |
| 46    | `organisms/admin/admin-service-day-timeline.tsx`  |
| 43    | `app/(management)/auth/signin/page.tsx`           |
| 42    | `templates/management/index.tsx`                  |
| 36    | `app/(management)/admin/incidents/page.tsx`       |

Any literal without a `dark:` sibling is a dark-mode bug in waiting —
`incidents/page.tsx:365`'s `bg-gray-50 p-3 rounded-lg` panel, for instance, is
a near-white block on a dark page. This is the structural cause behind F2.6
and much of the theme drift.

`reservation-timeline-legacy.tsx` is named "legacy"; confirm whether it is
still mounted before spending any effort on its 53 literals.

### F2.8 — `--border` at 1.26:1 makes inputs effectively borderless _(Medium)_

Light `--border: oklch(0.922 0 0)` (#e5e5e5) against a white card is
**1.26:1**, well under the 3:1 that SC 1.4.11 requires for the visual boundary
of a form control. Text inputs, selects and textareas have no perceptible
edge. Dark mode's `oklch(1 0 0 / 10%)` is comparably faint.

Low user-visible drama, straightforward token fix, so it is grouped with the
other token work rather than treated separately.

### F2.9 — Smaller a11y items _(Low)_

- **No skip-to-content link** in `src/app/layout.tsx` or either management
  layout. Every admin page makes a keyboard user tab through the full sidebar
  first (WCAG 2.4.1, Level A).
- **`CommandDialog` has no accessible name.** `src/components/ui/command.tsx:31`
  renders a `DialogContent` with no `DialogTitle` — Radix logs a dev warning
  and the dialog is announced anonymously. It backs the event `FormPicker`.
  Fix is a `<DialogTitle className="sr-only">`. Every _other_ `DialogContent`
  in the codebase has a title; this is the one primitive that doesn't.
- **Tables have almost no semantics.** 132 `<Table>`/`<table>` references and
  exactly **1** `scope="col"` or `<caption>` in the entire tree.
- **`Markdown` content starts at `h1`.** `molecules/markdown.tsx` styles
  `[&_h1]`, and admin-authored event descriptions are embedded in pages that
  already have an `h1` — a heading-order violation whenever an author starts
  with `#`. Either shift rendered headings down one level or document the
  convention in the editor.
- **`bg-[repeating-linear-gradient(...#99a1af...)]`** (WeekCalendar 769, 801-802)
  hardcodes its hatch color with no dark variant, unlike the sibling
  `cross_resource` stripe on line 801 which correctly has `dark:`.

---

## Part 3 — Security

### What is already good

- **No secret is exposed to the client.** The only `NEXT_PUBLIC_*` reference in
  `src/` is `NEXT_PUBLIC_TURNSTILE_SITEKEY` (signin page, lines 355 and 450),
  which is public by design.
- **No `localStorage` holds anything sensitive** — the sole use is
  `landing/theme/emoji-shower.tsx:56-57`, a once-per-day "already played" flag.
  No `document.cookie` access anywhere.
- **Markdown rendering is safe.** `molecules/markdown.tsx` uses react-markdown +
  `remark-gfm` with **no `rehype-raw`**, so admin-authored HTML is escaped, and
  react-markdown's default `urlTransform` neutralizes `javascript:` hrefs. The
  component's own comment claims this and the claim checks out. Since event
  descriptions are admin-authored but publicly rendered, this mattered.
- **The one `dangerouslySetInnerHTML`** (`src/components/ui/chart.tsx:95`) is
  stock shadcn `ChartStyle`, interpolating a developer-authored `ChartConfig`
  into a `<style>`. No user input reaches it.
- **`middleware.ts` is sound**: `secureCookie` is correctly gated on
  `NODE_ENV === "production"`, and it layers `isAdminRole` + per-path
  `hasPermission`. Its comment correctly notes the JWT role can lag a
  promotion, which is why API routes re-read from the DB via
  `requirePermission()`. The middleware is a fast path, not the authority —
  that is the right design.

### F3.1 — CSP is present but provides essentially no XSS protection _(High)_

`next.config.ts:29-46` sets exactly three directives:

```
script-src 'self' 'unsafe-inline' 'unsafe-eval' https://challenges.cloudflare.com;
frame-src  'self' https://challenges.cloudflare.com;
connect-src 'self' https://challenges.cloudflare.com;
```

Problems, in order of importance:

1. **`'unsafe-inline'` in `script-src` defeats the point.** The header's only
   real job is to stop injected script from executing; `'unsafe-inline'`
   permits exactly that. Next.js supports nonce-based CSP generated in
   middleware, which is the supported way to keep its inline bootstrap
   scripts working without the blanket allowance.
2. **`'unsafe-eval'` should not ship to production.** It is needed by the dev
   bundler, not by the built app. The file already demonstrates the pattern —
   `__impeccableLiveDev` is gated on `NODE_ENV === "development"` — so gate
   `'unsafe-eval'` the same way.
3. **No `base-uri`.** Without `base-uri 'self'`, an injected `<base href>`
   re-targets every relative URL on the page, including form posts. This is
   the cheapest high-value directive available and it is missing.
4. **No `object-src 'none'`, `default-src`, `form-action 'self'`, `img-src`,
   `style-src`, `font-src`.** With no `default-src` fallback, every
   unspecified directive is unrestricted.
5. **No `frame-ancestors`** — see F3.2.

Adding `img-src` needs care: it must admit `*.public.blob.vercel-storage.com`
and `STORAGE_PUBLIC_HOST` to match `next.config.ts`'s own
`images.remotePatterns`, or event/space images break.

### F3.2 — No clickjacking protection _(Medium)_

Neither `frame-ancestors` (in the CSP) nor an `X-Frame-Options` header is set,
so any site can iframe the app. The exposure is the authenticated admin
surface: `/admin/users` (role changes, bans), `/admin/spaces` (destructive
CRUD) and the participant approve/reject bar are all one-click actions behind
a session cookie.

Mitigating factor: NextAuth's session cookie is `SameSite=Lax` by default, and
Lax cookies are **not** sent on cross-site iframe subresource requests — so a
framed page would render logged-out for most modern browsers. That downgrades
this from High to Medium, but it is a defense that depends on a default we
don't control and don't assert anywhere.

`frame-ancestors 'none'` is one line in the existing header block.

### F3.3 — Other missing security headers _(Low–Medium)_

Nothing but the CSP is set in `next.config.ts`:

- **`X-Content-Type-Options: nosniff`** — missing. Relevant because
  `/api/admin/events/[id]/participants/file` and the various `upload` routes
  serve user-supplied files.
- **`Strict-Transport-Security`** — missing. Vercel sets HSTS on
  `*.vercel.app`, but the project targets a custom domain where it should be
  explicit.
- **`Referrer-Policy`** — missing. Browsers now default to
  `strict-origin-when-cross-origin`, so the real exposure is low, but the
  public `/forms/[slug]` and `/forms/response/[token]` URLs are the kind of
  thing that should never leak in a `Referer`. **`[token]` is a capability
  token in the path** (`EventParticipant.editToken` — it grants edit and
  cancel without an account), so `Referrer-Policy: no-referrer` on that route
  specifically is worth considering beyond the site-wide default.
- **`Permissions-Policy`** — missing; no camera/mic/geolocation is used, so
  denying them is free.

### F3.4 — `target="_blank"` without `rel` on a link built from data _(Low)_

13 `target="_blank"` sites. Nine set `rel="noopener noreferrer"` correctly.
The four that don't:

| Site                            | Href source               | Assessment                                                                            |
| ------------------------------- | ------------------------- | ------------------------------------------------------------------------------------- |
| `molecules/logo-card.tsx:14`    | `partner.url`             | from `src/lib/constants/partners.ts` — a **checked-in constant**, not DB or user data |
| `WeekCalendar.tsx:1053`         | `/forms/${slug}`          | internal, template literal                                                            |
| `markdown-editor.tsx:363`       | `MARKDOWN_DOCS_URL` const | internal                                                                              |
| `form-template-builder.tsx:903` | uploaded file `url`       | own storage provider                                                                  |

Severity is Low because none of these takes a user-supplied absolute URL, and
browsers have defaulted `target="_blank"` to implicit `noopener` since 2021.
It is worth fixing `logo-card.tsx` anyway: if partners ever move from a
constants file to admin-editable site config — plausible, given `/admin/site`
already exists — it becomes a real reverse-tabnabbing and
`javascript:`-scheme sink on a public page. Fixing it now is one attribute;
fixing it after the migration means remembering.

---

## Severity summary

| ID   | Severity     | Area     | Finding                                                             |
| ---- | ------------ | -------- | ------------------------------------------------------------------- |
| F2.1 | **Critical** | A11y     | Focus ring at 1.01–1.20:1 in light mode, app-wide                   |
| F2.5 | **Critical** | A11y     | `WeekCalendar` mouse-only; white-on-yellow at 1.92:1                |
| F1.1 | High         | Errors   | No `error.tsx` / `global-error.tsx` anywhere                        |
| F1.2 | High         | Errors   | 9 `useApi` callers render errors as empty states                    |
| F1.6 | High         | Errors   | Admin Incidents UI wired to a 501 stub                              |
| F2.2 | High         | A11y     | `--muted-foreground` at 3.06:1 light; 220 usages                    |
| F2.4 | High         | A11y     | Gradient headings fade to 1.22:1 at their light end                 |
| F3.1 | High         | Security | CSP has `'unsafe-inline'`, no `base-uri`/`object-src`/`default-src` |
| F1.3 | Medium       | Errors   | `magic-link` renders a raw `SyntaxError` message                    |
| F1.4 | Medium       | Errors   | 4 submit handlers fail silently on network error                    |
| F1.5 | Medium       | Errors   | 27/58 routes bypass the envelope; some never log                    |
| F2.3 | Medium       | A11y     | `text-la-nube-primary` at 3.06:1                                    |
| F2.6 | Medium       | A11y     | 4 duplicated status-badge maps, none theme-aware                    |
| F2.7 | Medium       | A11y     | 786 hardcoded palette literals bypass tokens                        |
| F2.8 | Medium       | A11y     | `--border` at 1.26:1 — inputs read as borderless                    |
| F3.2 | Medium       | Security | No `frame-ancestors` / `X-Frame-Options`                            |
| F1.7 | Low          | Errors   | Dead optimistic `signedUp: true` on failure                         |
| F2.9 | Low          | A11y     | No skip link; unnamed `CommandDialog`; table semantics              |
| F3.3 | Low          | Security | No nosniff / HSTS / Referrer-Policy / Permissions-Policy            |
| F3.4 | Low          | Security | `logo-card` `target="_blank"` without `rel`                         |

---

## Implementation plan

Sliced so each slice is independently shippable and independently revertable.
Ordered by (impact ÷ risk), not by severity alone — slice 1 is first because
it is a handful of token values that fixes findings across every page.

### Slice A — Design tokens _(fixes F2.1, F2.2, F2.3, F2.4, F2.8)_

Touches `src/app/globals.css` almost exclusively, plus the handful of call
sites using `la-nube-primary` as text.

1. Re-point `--ring` at a real focus color per theme and drop the `/50` in
   `button.tsx`, `input.tsx` and the `*` base rule, so the token's measured
   ratio is what ships. Target ≥ 3:1 against both `--background` and `--card`
   in both themes.
2. Darken light `--muted-foreground` to clear 4.5:1 on white **and** on
   `#e2e8f0`. Leave the dark value alone — it already measures 6.91:1.
3. Raise `--border` in both themes to ≥ 3:1 against `--card`.
4. Re-anchor the landing gradients to the `selected → primary` (light) /
   `primary → secondary` (dark) pair the eyebrow labels already use.
5. Replace `text-la-nube-primary` with the sanctioned
   `text-la-nube-selected dark:text-la-nube-secondary` pair at the ~8 text
   sites in F2.3. Leave borders, spinners and gradient stops alone.

**Add a regression test.** The contrast script in the appendix should become
a real `*.test.ts` under `src/lib/` that parses the tokens out of
`globals.css` and asserts the ratios. Without it, slice A silently rots — this
is precisely how `--muted-foreground` got overridden in the first place.

### Slice B — Error boundaries and error surfacing _(F1.1, F1.2, F1.3, F1.4)_

1. Add `error.tsx` to `src/app/` (global), `(public)/`, `(management)/user/`,
   `(management)/admin/`, and `forms/` — branded, in Spanish, with a
   `reset()` retry. Add `global-error.tsx` at the root for the layout-crash case.
2. Make the nine `useApi` callers in F1.2 render an inline error + retry
   instead of their empty state. Deliberately **not** done by changing
   `useApi`.
3. Wrap the four handlers in F1.4 in `try`/`catch` with a toast — or better,
   route them through `apiSend` from `src/lib/api/client.ts`, which already
   carries `ApiError` and normalizes the message. Add the missing `catch` to
   `public-form.tsx`'s `handleCancel`.
4. Fix `magic-link`: `.catch(() => ({}))` on the `response.json()`, and
   narrow with `instanceof Error` instead of the `as Error` cast.
5. Delete the dead `update({ signedUp: true })` in `signup/page.tsx` (F1.7)
   and comment the `jwt` callback to record that it intentionally ignores
   client-supplied session updates.

### Slice C — Security headers _(F3.1, F3.2, F3.3, F3.4)_

Almost entirely `next.config.ts`, except the nonce work.

1. Expand the CSP: add `default-src 'self'`, `base-uri 'self'`,
   `object-src 'none'`, `form-action 'self'`, `frame-ancestors 'none'`, and an
   `img-src` that admits `*.public.blob.vercel-storage.com` +
   `STORAGE_PUBLIC_HOST` to match `images.remotePatterns`.
2. Gate `'unsafe-eval'` to development, reusing the existing
   `__impeccableLiveDev` pattern.
3. Add `X-Content-Type-Options`, `Strict-Transport-Security`,
   `Referrer-Policy`, `Permissions-Policy`. Consider a stricter
   `Referrer-Policy: no-referrer` scoped to `/forms/response/:path*` because
   the `editToken` is in the path.
4. Add `rel="noopener noreferrer"` to `logo-card.tsx`.
5. **Separately, and last:** replace `'unsafe-inline'` with a middleware-generated
   nonce. This is the highest-risk item in the milestone — a wrong nonce
   blanks the whole app — so it ships on its own, behind a staged rollout,
   after 1-4 are verified in preview.

### Slice D — Status badges and theme literals _(F2.6, F2.7)_

1. One theme-aware `StatusBadge` with a variant prop; migrate the four
   duplicated maps in `status-badge.tsx`, `users/columns.tsx`,
   `incidents/page.tsx`, `checkin/page.tsx` onto it.
2. Sweep the top offenders from F2.7 for literals with no `dark:` sibling.
   Confirm first whether `reservation-timeline-legacy.tsx` is still mounted —
   if not, delete it rather than fix its 53 literals.

### Slice E — `WeekCalendar` accessibility _(F2.5)_

Largest and least certain; deliberately last, and it may need to split out
into its own milestone.

1. Fix the contrast first — it is independent of the interaction work and
   lands immediately. `bg-yellow-500` at 1.92:1 must go.
2. Make occurrence cards real `<button>`s (or `role="button"` +
   `tabIndex={0}` + key handler) with an `aria-label` carrying what the
   `title` says today.
3. Add a keyboard path for _creating_ a reservation. The drag interaction
   cannot be made keyboard-accessible as-is; the realistic answer is an
   equivalent non-drag path — a "Reservar" button opening the same
   time-range dialog the drag currently populates. That is a product/design
   decision, not a mechanical fix.
4. Give the status glyphs text alternatives instead of bare emoji.

### Slice F — Remaining low items _(F1.5, F1.6, F2.9)_

1. Migrate the 26 non-NextAuth routes in F1.5 onto `apiCatch`/`apiSuccess`.
   Prioritize `forms/response/[token]/route.ts`, which has **no** `try`/`catch`
   and is a public endpoint whose failures are currently unlogged. Once done,
   the `{ error }` fallback in `ApiError` can be dropped.
2. Resolve Incidents (F1.6) per the Open Questions decision.
3. Skip link; `DialogTitle` in `CommandDialog`; table `scope`/`caption`;
   markdown heading levels.

---

## Open questions (need a decision before the affected slice)

1. **Incidents (F1.6): finish it or hide it?** The route is a 501 stub with a
   full commented-out implementation and a complete UI in front of it. The
   `Incident`/`IncidentUser` models exist. Finishing it is a feature, not a
   fix, and arguably belongs in its own milestone — but leaving a dead admin
   page in the nav is the worst option. _Recommendation:_ hide the nav entry
   in slice F, open a separate milestone to finish it.

2. **Calendar keyboard booking (F2.5 step 3): what is the non-drag path?**
   Drag-to-select cannot be made keyboard-operable in place. Options: (a) a
   "Reservar" button opening the existing time-range dialog pre-filled;
   (b) making each 15-minute cell focusable and space-to-extend, closer to
   Google Calendar. (a) is far cheaper and probably better for touch too.
   Needs a product call.

3. **CSP nonce (slice C step 5): is a preview-only rollout acceptable?** A
   wrong nonce blanks the entire app, and `npm run build` will not catch it.
   Recommend shipping to a preview deployment and walking every route group —
   including `/forms/[slug]`, which the auth-gated routes don't exercise —
   before promoting.

4. **How far does the token change reach (slice A)?** Darkening
   `--muted-foreground` changes the look of 220 usages at once. This is a
   deliberate visual change, not a neutral fix, and it should be looked at
   before merging. Is a slightly heavier secondary-text weight acceptable in
   exchange for AA?

5. **Is `reservation-timeline-legacy.tsx` dead?** 53 hardcoded literals in a
   file named "legacy". If nothing mounts it, slice D should delete it.

## Explicitly out of scope

- **Any runtime a11y testing.** No axe-core run, no screen-reader pass, no
  keyboard walkthrough. Everything in Part 2 is computed or read from source.
  A browser-based pass should follow slice A and will likely find more —
  especially around focus trapping in Radix portals and real tab order, which
  static analysis cannot see.
- **Performance.** Not audited. Noted only in passing that there are no
  `loading.tsx` files anywhere, so nothing streams.
- **Backend/API authorization.** `requirePermission()` and the RBAC model were
  read for context but not audited; `security-review` on the API surface is a
  separate exercise.
- **Mobile/responsive layout.** Not audited.
- **The `impeccable` dev allowance** in the CSP (`http://localhost:8400`) is
  correctly `NODE_ENV`-gated and was left alone.

## Appendix — reproducing the contrast numbers

Every ratio in Part 2 came from this script, run against the token values in
`src/app/globals.css`. It converts OKLCH → linear sRGB → sRGB, computes WCAG
2.1 relative luminance, and alpha-composites for the `/50` ring cases.

```js
const srgbLin = (c) =>
  c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
const lum = ([r, g, b]) =>
  0.2126 * srgbLin(r) + 0.7152 * srgbLin(g) + 0.0722 * srgbLin(b);
const hex = (h) => {
  h = h.replace("#", "");
  if (h.length === 3) h = [...h].map((c) => c + c).join("");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
};

function oklch(L, C, Hdeg) {
  // OKLCH -> sRGB
  const h = (Hdeg * Math.PI) / 180,
    a = C * Math.cos(h),
    bb = C * Math.sin(h);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * bb,
    m_ = L - 0.1055613458 * a - 0.0638541728 * bb,
    s_ = L - 0.0894841775 * a - 1.291485548 * bb;
  const l = l_ ** 3,
    m = m_ ** 3,
    s = s_ ** 3;
  const lr = +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const lg = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const lb = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
  const enc = (v) => {
    v = Math.max(0, Math.min(1, v));
    return v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055;
  };
  return [enc(lr), enc(lg), enc(lb)];
}

const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};
const over = (fg, bg, a) => fg.map((v, i) => v * a + bg[i] * (1 - a)); // for ring-ring/50

// Token values as of 34a91be:
const bgLight = oklch(0.929, 0.013, 255.508); // #e2e8f0
const bgDark = oklch(0.208, 0.042, 265.755); // #0f172b
const cardDark = oklch(0.205, 0, 0); // #171717
const ringLight = hex("#c8f1fc");
const ringDark = oklch(0.556, 0, 0); // #737373
```

Thresholds applied: **4.5:1** normal text (AA, SC 1.4.3); **3:1** large text
(≥ 18.66px bold or ≥ 24px) and non-text/UI boundaries (SC 1.4.11).
