---
name: La Nube — Polo Tecnológico
description: Coworking space management system for a community technology hub
colors:
  # Brand
  observatory-blue: "#4e87c2"
  deep-sky: "#2a6297"
  signal-cyan: "#75e3f1"
  ice-haze: "#c8f1fc"
  # Neutral system
  cloud-surface: "#e8ecf2"
  ink: "#303030"
  carbon: "#424242"
  whisper: "#f7f7f7"
  muted: "#888282"
  hairline: "#eaeaea"
  card-white: "#ffffff"
  night-station: "#1c2238"
typography:
  display:
    fontFamily: "Roboto, sans-serif"
    fontSize: "clamp(2.5rem, 7vw, 4.5rem)"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Roboto, sans-serif"
    fontSize: "clamp(1.25rem, 3vw, 2rem)"
    fontWeight: 700
    lineHeight: 1.25
  title:
    fontFamily: "Roboto, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.4
  body:
    fontFamily: "Roboto, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "Roboto Mono, monospace"
    fontSize: "0.75rem"
    fontWeight: 500
    letterSpacing: "0.2em"
rounded:
  sm: "6px"
  md: "8px"
  lg: "10px"
  xl: "14px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  2xl: "48px"
  3xl: "64px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.card-white}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
  button-primary-hover:
    backgroundColor: "{colors.observatory-blue}"
    textColor: "{colors.card-white}"
    rounded: "{rounded.md}"
  button-outline:
    backgroundColor: "transparent"
    textColor: "{colors.carbon}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
  button-outline-hover:
    backgroundColor: "{colors.whisper}"
    textColor: "{colors.carbon}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.carbon}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
  button-ghost-hover:
    backgroundColor: "{colors.hairline}"
    textColor: "{colors.carbon}"
  card:
    backgroundColor: "{colors.card-white}"
    rounded: "{rounded.xl}"
    padding: "24px"
  badge-default:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.card-white}"
    rounded: "{rounded.md}"
    padding: "2px 8px"
  badge-outline:
    backgroundColor: "transparent"
    textColor: "{colors.carbon}"
    rounded: "{rounded.md}"
    padding: "2px 8px"
---

# Design System: La Nube — Polo Tecnológico

## 1. Overview

**Creative North Star: "The Local Observatory"**

La Nube is a place where a community gathers to observe, explore, and build. The design system carries that identity: it is precise without being cold, local without being parochial, technical without being intimidating. Every surface should feel like it belongs to the people who use it — not to a vendor who packaged it for them.

The palette draws from the actual sky — a cornflower blue that reads as daytime, a signal cyan that hints at screens and broadcasts, a cool cloud-surface background that places you outdoors rather than inside a data centre. The system lives in both light and dark modes; dark mode shifts the metaphor from cloud to night sky, the `night-station` background anchoring an observatory aesthetic.

Typography is Roboto across the board — a humanist geometric sans-serif that carries both the warmth the community expects and the technical crispness the product needs. Roboto Mono plays a distinct role as the voice of the system itself: section kickers, timestamps, status labels, and the blinking cursor that greets visitors in the hero.

**Key Characteristics:**

- Warm and local, but not folksy — confident and community-made
- Blue carries identity, not just function — present at 30–50% of the surface, not decorative
- The mono typeface is the system speaking; Roboto is the content speaking
- Flat by default, alive on interaction — depth through state, not decoration
- Admin surfaces are never punishing — the same visual warmth applies everywhere

### Accessibility status (audited 2026-09-23)

This document is the **design intent**; a frontend audit on 2026-09-23 found
that several of its color prescriptions cannot meet WCAG 2.1 AA as written.
**Most of these were fixed in milestone-10 slice A (2026-09-23)** and the ratios are
now asserted by `src/lib/contrast.test.ts`, which parses `globals.css` and fails the
build if a token regresses. The table records what changed; the ⚠️ marks that remain
inline below are the ones still open.

| Item                                          | Was        | Now        | Needs          | State                                     |
| --------------------------------------------- | ---------- | ---------- | -------------- | ----------------------------------------- |
| Focus ring vs. cloud-surface                  | **1.01:1** | **5.17:1** | 3:1            | ✅ Fixed — now Deep Sky, `/50` removed    |
| Muted secondary text vs. cloud-surface        | **3.06:1** | **4.66:1** | 4.5:1 for body | ✅ Fixed — `#888282` → `#666666`          |
| Hairline border vs. card-white                | **1.26:1** | **3.11:1** | 3:1            | ✅ Fixed — `oklch(0.922)` → `oklch(0.66)` |
| Gradient tail (Signal Cyan) vs. cloud-surface | **1.22:1** | 1.22:1     | 3:1 (large)    | ⚠️ Open — decorative, see §3              |
| `text-la-nube-primary` as body text           | **3.06:1** | 3.06:1     | 4.5:1          | ✅ Rule enforced — call sites migrated    |

Dark mode is broadly healthier than light mode — the failures above are
light-mode-specific, because most of them originate in hand-overridden light
tokens while dark mode kept the stock Shadcn values. Ratios were computed, not
eyeballed; the script is in the milestone-10 appendix.

**Rule for new work:** don't build UI that depends on any of the five rows
above reading clearly, and don't cite them as precedent. Brand-colored _text_
goes through `text-la-nube-selected dark:text-la-nube-secondary`, which is
measured and passing.

## 2. Colors: The Observatory Palette

A two-hue palette anchored in blue and cyan — sky-inspired, community-owned. The brand lives in the mid-range: never so saturated it becomes corporate, never so desaturated it disappears.

### Primary

- **Observatory Blue** (`#4e87c2`): The brand anchor. Section headings, active navigation states, primary data points, the gradient source in display type. Appears on 30–50% of typical screens. Medium saturation; reads as trustworthy and local, not enterprise navy. ⚠️ **Not a text color in light mode** — `#4e87c2` is **3.06:1** on cloud-surface and **3.77:1** white-on-blue, both under AA. Use it for borders, icons, spinners, fills and gradient stops; for brand-colored _text_ use Deep Sky (`text-la-nube-selected dark:text-la-nube-secondary`), which measures 5.18:1 / 11.91:1. Milestone-10 F2.3.
- **Deep Sky** (`#2a6297`): The darker register of observatory blue. Used for section kickers and mono labels in light mode, active link states, hover deepening on blue-tinted elements. Never used as a body background.

### Secondary

- **Signal Cyan** (`#75e3f1`): The broadcast frequency. Used as the gradient target in display headings, section kickers in dark mode, and as a secondary accent in cards with themed backgrounds. Reads as technical and energetic — the cyan of screens and signals, not of tropical water.
- **Ice Haze** (`#c8f1fc`): The washed-out cousin of signal cyan. Used for section background tints and subtle hover surfaces in public-facing areas. Quiet enough to be structural, blue enough to be on-brand.

  **Ice Haze is no longer the focus-ring color** (fixed in milestone-10 slice A). It had measured 1.02:1 against cloud-surface and, applied at 50% opacity via `focus-visible:ring-ring/50`, landed at **1.01:1** — keyboard focus effectively invisible app-wide in light mode. `--ring` is now Deep Sky (`#2a6297`, 5.17:1 on cloud-surface / 6.38:1 on card-white), Signal Cyan in dark mode (11.96:1), and the `/50` modifier was removed from all 12 Shadcn primitives so the token's measured ratio is what actually renders. The property that makes Ice Haze good as a background tint — that it barely separates from the page — is exactly what disqualified it as an attention signal; **keep using it as a tint, never as a focus indicator.**

### Neutral

- **Cloud Surface** (`#e8ecf2`): Page background in light mode. Not white — a cool, faintly blue-tinted gray that places content in sky, not paper. The very slight chroma (OKLCH implementation: `oklch(92.9% 0.013 255.508)`) keeps it from reading as generic.
- **Ink** (`#303030`): Button primary background in light mode, highest-contrast text contexts. Slightly warmer than pure black — readable without clinical harshness.
- **Carbon** (`#424242`): Body text, form labels, default foreground. **10.1:1** against card-white and **8.2:1** against cloud-surface — comfortably AA/AAA; the everyday reading color. (An earlier revision of this line claimed 4.5:1; that was understated. Measured 2026-09-23.)
- **Whisper** (`#f7f7f7`): Muted surface backgrounds — disabled states, secondary panels, sidebar fills. Distinguishable from card-white when adjacent.
- **Muted** (`#666666`): Secondary text, timestamps, form helper text, empty-state copy. **4.66:1 against cloud-surface, 5.74:1 against card-white** — clears AA for body text at any size. It was `#888282` (3.06:1 / 3.78:1), which the codebase violated ~220 times via `text-muted-foreground`; milestone-10 slice A darkened the token rather than leave an unenforceable rule. That is a deliberate visual change across every one of those usages.
- **Hairline** (`#eaeaea`): Borders, dividers, card outlines. Invisible at rest; structural without visual weight.
- **Card White** (`#ffffff`): Card backgrounds in light mode. The explicit white against cloud-surface creates the surface hierarchy.
- **Night Station** (`#1c2238`): Page background in dark mode. Deep navy-blue, not pure black — the OKLCH implementation (`oklch(20.8% 0.042 265.755)`) pulls toward indigo for a sky-at-night reading.

### Named Rules

**The Observatory Rule.** Observatory Blue must appear on every screen. It is the brand signal. A screen without it looks unbranded; a screen where it appears only in the footer has failed. Active states, section headings, and key navigation markers are the minimum.

**The Signal Cyan Rule.** Signal Cyan is never used alone; it always appears in relation to Observatory Blue — as a gradient partner, a dark-mode counterpart, or a supporting accent. Isolated Signal Cyan reads as a different product.

**The Muted Floor.** `#666666` is the floor for secondary text (4.66:1 on cloud-surface). Nothing dimmer on body copy. For non-text elements (borders, separators), hairline is the floor — itself raised to 3.11:1 against card-white. Both floors are now asserted in `src/lib/contrast.test.ts`: if you change a token and that test fails, the token is wrong.

## 3. Typography: Roboto as Community + System

**Display Font:** Roboto (Google Fonts, weight 700, sans-serif)
**Body Font:** Roboto (weight 400/500, sans-serif)
**System/Label Font:** Roboto Mono (weight 500, monospace)

**Character:** A single-family system built on contrast of mode, not face. Roboto handles the human layer — the content, the headings, the interface labels — while Roboto Mono voices the system itself. The combination reads as both warm and precise: a community space that also runs software.

### Hierarchy

- **Display** (700, `clamp(2.5rem, 7vw, 4.5rem)`, line-height 1.1, letter-spacing -0.02em): Landing page hero only. "La Nube" as the primary mark. Uses the primary-to-secondary gradient treatment (the single intentional exception to the gradient-text prohibition — see Do's and Don'ts).
- **Headline** (700, `clamp(1.25rem, 3vw, 2rem)`, line-height 1.25): Section headings on landing and admin dashboards. The highlight word in a headline receives the Observatory Blue / Signal Cyan gradient — one word, not a phrase.
- **Title** (600, 1.125rem, line-height 1.4): Card headings, dialog titles, sidebar section labels. No gradient.
- **Body** (400, 1rem, line-height 1.6): All prose content, form labels, table cells. Cap at 65–75ch. Carbon (`#424242`) on card-white or cloud-surface.
- **Label / Kicker** (Roboto Mono, 500, 0.75rem, tracking 0.2em, uppercase): Section kickers (`~/ eventos`), status badges, timestamps, system-generated identifiers. Deep Sky in light mode; Signal Cyan in dark mode. Always accompanied by a blinking cursor (`▌ animate-blink`) when marking the current section — one per screen.

### Named Rules

**The Mono Voice Rule.** Roboto Mono is the system speaking. It appears on section kickers, status labels, form IDs, and timestamps — never on user-authored content (event titles, reservation notes, names). If you're unsure which to use, ask: is this text the system or a person? Mono = system.

**The One Gradient Word Rule.** In any given heading, at most one word or phrase receives the primary-to-secondary gradient. If all words are gradient, none is. The gradient marks the concept — "innovación", "eventos", the promise — not the whole sentence.

**The Gradient Legibility Rule** (added 2026-09-23). The gradient must stay legible across its whole run, in both themes. The current light-mode pair does not: `from-la-nube-primary` (`#4e87c2`) measures **3.06:1** against cloud-surface and `to-la-nube-secondary` (`#75e3f1`) measures **1.22:1** — so the tail of every gradient word fades into the page, even at Display/Headline sizes where only 3:1 is required. Light mode needs to run `selected → primary` (Deep Sky `#2a6297` is **5.18:1**); dark mode's `primary → secondary` is fine (Signal Cyan is 11.91:1 on night-station). This is milestone-10 F2.4 / slice A — the gradient stays, its anchors change.

## 4. Elevation

La Nube is flat by default. Surfaces rest at rest. Shadow is a response to state, never a default decoration. The system achieves hierarchy through background color contrast (card-white over cloud-surface, night-station card over slightly lighter panel) and border presence, not layering.

### Shadow Vocabulary

- **Interaction lift** (`0 4px 16px 0 rgba(78, 135, 194, 0.2)`): Applied on hover to reservation cards and event cards. The shadow is tinted Observatory Blue — it reads as the brand reaching toward the user. Replaces the standard dark-gray shadow.
- **Interaction lift (strong)** (`0 6px 20px 0 rgba(78, 135, 194, 0.3)`): Used for more prominent hover states in admin list views.
- **Glass panel** (`0 4px 16px 0 rgba(0, 0, 0, 0.2)`): Applied to the public-facing header/nav, which uses `backdrop-blur-sm` with a semi-transparent background. The one structural use of glassmorphism — bounded to the navigation layer only.
- **Admin sidebar** (`4px 0 24px 0 rgba(31, 38, 135, 0.15)` / dark mode: `rgba(0, 0, 0, 0.15)`): Lateral shadow on the fixed admin sidebar panel.
- **Card ambient** (`0 2px 8px 0 rgba(31, 38, 135, 0.1)` / dark mode: `rgba(0, 0, 0, 0.1)`): Resting shadow on key admin cards. Barely perceptible at rest; provides lift without drama.

### Named Rules

**The Blue Shadow Rule.** When a card or interactive element is the primary content (reservation cards, event cards), its hover shadow is tinted Observatory Blue — not generic gray. The shadow carries the brand, not just depth.

**The Glass Boundary Rule.** Glassmorphism (`backdrop-blur` + semi-transparent bg + white/30% border) is permitted only on the public navigation header. Nowhere else. It is structural in one place; decorative everywhere else.

## 5. Components

### Buttons

Character: Confident and direct. The default button is dark charcoal with white text — decisive, not branded. The brand blue appears on hover, rewarding the interaction.

- **Shape:** Gently rounded (8px radius, `rounded-md`)
- **Primary (default):** Ink (`#303030`) background, white text; `px-4 py-2 h-9`. On hover: transitions to Observatory Blue (`#4e87c2`). On focus-visible: 3px ring in Deep Sky at full strength (5.17:1) — the `/50` opacity modifier was removed in milestone-10 slice A.
- **Outline:** Transparent background, hairline border, carbon text. On hover: Whisper background.
- **Ghost:** No border, no background. On hover: Hairline background fill. Used for secondary actions in dense admin tables.
- **Destructive:** Red-tinted background (Shadcn destructive token); white text. Reserved for irreversible actions.
- **Disabled:** 50% opacity on all variants. `pointer-events-none`.

### Badges / Chips

Character: Small, contained, read-only status signals or type labels.

- **Default:** Ink background, white text, 8px radius; `px-2 py-0.5 text-xs`.
- **Outline:** Hairline border, carbon text, transparent background. For read-only metadata (event type tags, resource type labels).
- **Secondary:** Whisper background, carbon text. For lower-hierarchy status indicators.
- **Status badges:** one system, in `atoms/status-badge.tsx`. `ToneBadge` takes a `tone` (`success` / `danger` / `warning` / `info` / `neutral`), each defined once for both themes; `StatusBadge`, `UserStatusBadge` and `IncidentStatusBadge` map a domain status onto a tone. **Never write a new status→color `switch`** — that is exactly what milestone-10 slice D consolidated away (four duplicated, light-only maps that rendered as bright pastel chips on a near-black card in dark mode).

### Cards

Character: White surfaces that float cleanly off the cloud-surface background. No hover shadow at rest; Observatory Blue-tinted shadow on interaction.

- **Corner Style:** Extra rounded (14px radius, `rounded-xl`) — distinct from button radius, signals a container not a control.
- **Background:** Card White on light mode; dark card on dark mode.
- **Shadow Strategy:** `shadow-sm` at rest. On hover (where interactive): transitions to interaction lift shadow.
- **Border:** `border border-hairline` — present but invisible at rest; defines shape on white surfaces.
- **Internal Padding:** `p-6` (24px) default. `py-6 px-6` with semantic slot sub-components (CardHeader, CardContent, CardFooter).

**Event Card (signature component):** Full-bleed cover image with stretched-link overlay. The CTA (registration button) sits at `z-[2]`, above the stretched link at `z-[1]`. Cover image uses `aspect-[16/10]` or `aspect-square` variants. The card is `overflow-hidden rounded-2xl` — tighter radius than default cards, emphasizing the image container.

### Inputs / Fields

Character: Clean stroke fields — no filled backgrounds, no floating labels. The focus state is the brand speaking.

- **Style:** Transparent background, hairline border (`border border-input`), 8px radius; `h-9 px-3 text-sm`. `shadow-xs` at rest.
- **Focus:** 3px ring at full strength with border color transitioning to the ring color. The focus state is the one place where the system accent visually activates. The ring is Deep Sky in light mode (5.17:1 on cloud-surface, 6.38:1 on card-white) and Signal Cyan in dark (11.96:1). **Do not reintroduce an opacity modifier on it** — the shipped `/50` was what dropped the old ring to 1.01:1.
- **Border contrast:** Hairline against card-white measures **3.11:1**, clearing the 3:1 SC 1.4.11 requires for a control's visual boundary. It was 1.26:1 (inputs read as borderless) until milestone-10 slice A.
- **Error:** Destructive-red ring and border; `aria-invalid` attribute drives the visual state.
- **Disabled:** 50% opacity, `cursor-not-allowed`.

### Navigation

Character: The public header uses glass morphism — the single structural exception. The admin sidebar is opaque and left-anchored.

- **Public header:** `bg-white/10 backdrop-blur-sm border-b border-white/20` — glass treatment, positioned over the particle canvas background. Logo left, nav links center, auth actions right.
- **Admin sidebar:** Opaque, Observatory Blue tint on active item backgrounds, Carbon foreground for all labels.
- **Active state:** Observatory Blue background tint, Deep Sky text for the active nav item. No underline, no left-stripe.

### Mono Kicker (signature element)

Character: The system's voice — a small line above section headings that announces what follows, formatted as a terminal path.

- **Format:** `~/ [section-name]` followed by a blinking cursor (`▌`).
- **Style:** Roboto Mono, 0.75rem, uppercase, tracking 0.2em; Deep Sky in light mode, Signal Cyan in dark mode.
- **Rule:** One per screen. It marks the section, not every sub-section. The blinking cursor (`animate-blink`) runs only on the primary section identifier.

## 6. Do's and Don'ts

### Do:

- **Do** use Observatory Blue on every screen, in at least one prominent element — an active nav state, a section heading highlight, or a primary data value. Screens without it look unbranded.
- **Do** tint hover shadows with Observatory Blue (`rgba(78, 135, 194, …)`) on cards that are the primary content focus. It makes the interaction feel on-brand, not generic.
- **Do** use Roboto Mono exclusively for system-generated, machine-voiced content: kickers, status labels, timestamps, identifiers. Never use it for user-authored titles or descriptions.
- **Do** maintain 4.5:1 contrast for all body text (Carbon `#424242` on Card White `#ffffff` = 7.7:1 ✓; Carbon on Cloud Surface `#e8ecf2` ≈ 5.6:1 ✓).
- **Do** keep line length at 65–75ch for body copy. Use `max-w-prose` as the Tailwind shorthand.
- **Do** give the one intentional gradient-text usage — Display heading in the hero, one highlight word per Headline — its bounded role. It is the brand signature, not a general tool.
- **Do** use `text-wrap: balance` on headings (H1–H3) and `text-wrap: pretty` on multi-line paragraph copy.
- **Do** confine glassmorphism to the public navigation header. One structural use; nowhere else.

### Don't:

- **Don't** build a WeWork or Regus surface — stock-photography hero, enterprise coldness, brand-as-status. La Nube is community-owned, not investor-owned. Every screen must feel made for the people using it.
- **Don't** build a university admin portal — no circa-2015 table-heavy UIs, no forms that feel punitive, no navigation that assumes the user will memorize paths. Admin surfaces are warm, not institutional.
- **Don't** use gradient text anywhere outside the Display hero heading and the one Headline highlight word. The `bg-gradient-to-r from-la-nube-primary to-la-nube-secondary bg-clip-text text-transparent` pattern is a bounded brand signature — applying it to buttons, labels, secondary headings, or card titles makes everything shout at once.
- **Don't** add a side-stripe border (colored `border-left` > 1px) to cards, alerts, or list items as a status or category signal. Use full borders, background tints, or status badges instead.
- **Don't** use Muted (`#888282`) for body text below 18px — it falls below 4.5:1 against Cloud Surface. Reserve it for helper text and secondary metadata at larger sizes where the 3:1 threshold applies.
- **Don't** use boxed shadows as decoration at rest. `shadow-sm` is acceptable on admin cards; `shadow-md` or above at rest reads as inflated UI.
- **Don't** put a mono kicker above every section. One per screen. Kickers used on every sub-section become visual noise and strip the terminal-path metaphor of its meaning.
- **Don't** use generic dark-gray box shadows on interactive cards. If a card lifts on hover, its shadow must be tinted Observatory Blue — the brand is present in every state, including depth.
