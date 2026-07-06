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

## 2. Colors: The Observatory Palette

A two-hue palette anchored in blue and cyan — sky-inspired, community-owned. The brand lives in the mid-range: never so saturated it becomes corporate, never so desaturated it disappears.

### Primary

- **Observatory Blue** (`#4e87c2`): The brand anchor. Section headings, active navigation states, primary data points, the gradient source in display type. Appears on 30–50% of typical screens. Medium saturation; reads as trustworthy and local, not enterprise navy.
- **Deep Sky** (`#2a6297`): The darker register of observatory blue. Used for section kickers and mono labels in light mode, active link states, hover deepening on blue-tinted elements. Never used as a body background.

### Secondary

- **Signal Cyan** (`#75e3f1`): The broadcast frequency. Used as the gradient target in display headings, section kickers in dark mode, and as a secondary accent in cards with themed backgrounds. Reads as technical and energetic — the cyan of screens and signals, not of tropical water.
- **Ice Haze** (`#c8f1fc`): The washed-out cousin of signal cyan. Used for focus rings (the system's attention signal), section background tints, and subtle hover surfaces in public-facing areas. Quiet enough to be structural, blue enough to be on-brand.

### Neutral

- **Cloud Surface** (`#e8ecf2`): Page background in light mode. Not white — a cool, faintly blue-tinted gray that places content in sky, not paper. The very slight chroma (OKLCH implementation: `oklch(92.9% 0.013 255.508)`) keeps it from reading as generic.
- **Ink** (`#303030`): Button primary background in light mode, highest-contrast text contexts. Slightly warmer than pure black — readable without clinical harshness.
- **Carbon** (`#424242`): Body text, form labels, default foreground. 4.5:1 contrast against card-white; the everyday reading color.
- **Whisper** (`#f7f7f7`): Muted surface backgrounds — disabled states, secondary panels, sidebar fills. Distinguishable from card-white when adjacent.
- **Muted** (`#888282`): Secondary text, timestamps, form helper text, empty-state copy. 3:1 contrast against cloud-surface for large text. Do not use for body text below 18px.
- **Hairline** (`#eaeaea`): Borders, dividers, card outlines. Invisible at rest; structural without visual weight.
- **Card White** (`#ffffff`): Card backgrounds in light mode. The explicit white against cloud-surface creates the surface hierarchy.
- **Night Station** (`#1c2238`): Page background in dark mode. Deep navy-blue, not pure black — the OKLCH implementation (`oklch(20.8% 0.042 265.755)`) pulls toward indigo for a sky-at-night reading.

### Named Rules

**The Observatory Rule.** Observatory Blue must appear on every screen. It is the brand signal. A screen without it looks unbranded; a screen where it appears only in the footer has failed. Active states, section headings, and key navigation markers are the minimum.

**The Signal Cyan Rule.** Signal Cyan is never used alone; it always appears in relation to Observatory Blue — as a gradient partner, a dark-mode counterpart, or a supporting accent. Isolated Signal Cyan reads as a different product.

**The Muted Floor.** `#888282` is the floor for secondary text. Nothing dimmer on body copy. For non-text elements (borders, separators), hairline is the floor.

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
- **Primary (default):** Ink (`#303030`) background, white text; `px-4 py-2 h-9`. On hover: transitions to Observatory Blue (`#4e87c2`). On focus-visible: 3px ring in Ice Haze.
- **Outline:** Transparent background, hairline border, carbon text. On hover: Whisper background.
- **Ghost:** No border, no background. On hover: Hairline background fill. Used for secondary actions in dense admin tables.
- **Destructive:** Red-tinted background (Shadcn destructive token); white text. Reserved for irreversible actions.
- **Disabled:** 50% opacity on all variants. `pointer-events-none`.

### Badges / Chips

Character: Small, contained, read-only status signals or type labels.

- **Default:** Ink background, white text, 8px radius; `px-2 py-0.5 text-xs`.
- **Outline:** Hairline border, carbon text, transparent background. For read-only metadata (event type tags, resource type labels).
- **Secondary:** Whisper background, carbon text. For lower-hierarchy status indicators.

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
- **Focus:** 3px ring in Ice Haze (`#c8f1fc`) with border color transitioning to the ring color. The focus state is the one place where the system accent visually activates.
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
