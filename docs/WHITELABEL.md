# Whitelabeling the platform

This app is brand-agnostic. Everything specific to a deployment's identity lives in a
single file — **`app.config.ts`** at the repo root — so you can rebrand without touching
feature code.

## Quick start

Open `app.config.ts` and edit the `brand`, `contact`, and `copy` blocks:

```ts
export default defineAppConfig({
  brand: {
    name: "Acme Hub",
    tagline: "Coworking & Community",
    description: "Your space to build.",
    logo: AcmeLogo, // a React component, see "Logo" below
    theme: {
      primary: "#4e87c2",
      selected: "#2a6297",
      secondary: "#75e3f1",
      accent: "#c8f1fc",
    },
    themeStorageKey: "acme-theme",
  },
  contact: { email, phone, clickablePhone, address, social },
  copy: {
    hero: { title, subtitlePrefix, keywords, description },
    footerTagline,
  },
  modules: { events: { enabled: true }, news: { enabled: false } },
});
```

That's it — the brand name, metadata/tab title, footer, hero, forms shell, and theme
colors all follow this file.

## What each block controls

| Block                           | Drives                                                      |
| ------------------------------- | ----------------------------------------------------------- |
| `brand.name`                    | Page `<title>`, footer heading, forms shell, aria labels    |
| `brand.tagline` / `description` | SEO metadata (`src/app/layout.tsx`)                         |
| `brand.theme`                   | The `--color-brand-*` CSS variables (see "Colors")          |
| `brand.logo`                    | Every logo slot across the app (`<Brand/>`)                 |
| `contact`                       | Footer contact details + social links; privacy policy email |
| `copy`                          | Hero + footer text (single language; no i18n)               |
| `modules`                       | Which features are on (see [MODULES.md](./MODULES.md))      |

## Logo

Provide any React component that accepts `{ size?: number; className?: string }` and set
it as `brand.logo`. The app renders it everywhere through the `<Brand/>` slot
(`src/components/atoms/logos/brand.tsx`) — components never import a specific logo.
The default La Nube mark lives at `src/components/atoms/logos/lanube` as an example.

## Colors

Brand colors are declared **once** in `app.config.ts` under `brand.theme`. At runtime,
`<BrandThemeStyle/>` (in the root layout) injects them as `--color-brand-*` CSS variables,
overriding the defaults baked into `src/app/globals.css`. Tailwind utilities like
`bg-brand-primary`, `text-brand-secondary`, `from-brand-primary` all resolve to these
variables — so changing a hex in the config recolors the whole app with no CSS edits.

> Note: a few decorative glass effects in `globals.css` (`.glass-button`, etc.) use baked
> literal RGBA tints and won't follow the config. Adjust them there if needed.

## Environment overrides

A handful of fields can be overridden per-environment (e.g. staging vs prod) without
editing the config file, via `NEXT_PUBLIC_*` env vars resolved in `src/config/index.ts`:

| Env var                         | Overrides           |
| ------------------------------- | ------------------- |
| `NEXT_PUBLIC_BRAND_NAME`        | `brand.name`        |
| `NEXT_PUBLIC_BRAND_TAGLINE`     | `brand.tagline`     |
| `NEXT_PUBLIC_BRAND_DESCRIPTION` | `brand.description` |
| `NEXT_PUBLIC_CONTACT_EMAIL`     | `contact.email`     |

## Bringing your own frontend

The public landing (`src/app/(public)`) and its sections (`src/components/templates/landing`)
are meant to be replaced or restyled per deployment. Pull live data from modules through
the standardized accessor rather than the database — e.g. upcoming events:

```tsx
import { modules } from "@/modules";

const events = modules.events; // undefined if the module is disabled
const upcoming = events
  ? await events.getUpcoming(1, events.config.landingLimit)
  : null;
```

See [MODULES.md](./MODULES.md) for the full module data API.

### Known limitation: this is "restyle", not "replace"

Today "bring your own frontend" means editing/restyling the existing components in place —
there's no seam that lets a deployment swap in a _different set of public pages_
(add/remove/rename routes like `/spaces` or `/about`) without forking the app. A component-level
`<Landing/>` slot (config picks an implementation, same pattern as a module) would only solve
the "different look" case, not "different pages."

**Planned direction (not started):** split this into two standalone apps — a public marketing
site (landing + whatever public pages a deployment wants) and a management app (the current
auth-gated `(management)` section + its API), talking to each other only over the public HTTP
API. That's the level of flexibility a real integrator needs (delete pages, add pages, use a
different framework entirely for the landing) and it keeps this project cloud-agnostic (no
platform-specific multi-zone/microfrontends tooling — deliberately avoided since this is open
source and shouldn't be tied to one hosting provider). Tradeoff: two apps to run instead of one.
Also on the table for that same future split: a Rust API backend (this project is likely to be
mostly self-hosted by individual coworking spaces/municipalities rather than run as a hosted
SaaS, so a single low-footprint binary is attractive) with a React (Vite or Next.js) management
frontend — most of the actual domain complexity (RRULE expansion, ledger/capacity checks) already
lives in Postgres SQL functions, so the app-layer surface to port is smaller than it looks.
SEO note for that split: as long as the landing keeps rendering API-sourced content (available
spaces, future opening-hours data) server-side — SSR/SSG/ISR, not a client-side fetch after
mount — moving the data source from local Prisma calls to a remote API changes nothing for
crawlers. The risk is only in _how_ the landing renders, not in what serves the JSON.
