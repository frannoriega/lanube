import type { ComponentType } from "react";

/**
 * Whitelabel configuration contract.
 *
 * Everything brand-specific lives in the root `app.config.ts`, which is the single
 * file an integrator edits to rebrand the platform. This module only defines the
 * shape of that config plus `defineAppConfig()` for typed authoring.
 */

/** Props every brand logo component must accept. */
export interface LogoProps {
  size?: number;
  className?: string;
}

export type LogoComponent = ComponentType<LogoProps>;

/** Brand color tokens. Injected as `--color-brand-*` CSS variables at runtime. */
export interface BrandTheme {
  /** Main brand color (buttons, links, accents). */
  primary: string;
  /** Darker/selected shade of the primary. */
  selected: string;
  /** Secondary/gradient companion color. */
  secondary: string;
  /** Light tint used for soft backgrounds. */
  accent: string;
}

export interface BrandConfig {
  /** Product/brand name shown across the UI and in metadata. */
  name: string;
  /** Optional compact name for tight spots (defaults to `name`). */
  shortName?: string;
  /** Short marketing tagline. */
  tagline: string;
  /** SEO/meta description. */
  description: string;
  /** Logo component. Swap this to rebrand the mark everywhere. */
  logo: LogoComponent;
  /** Brand colors, injected as CSS variables so utilities like `bg-brand-primary` follow config. */
  theme: BrandTheme;
  /** next-themes localStorage key. Change to avoid clashing with other apps on the same host. */
  themeStorageKey?: string;
}

export interface AddressConfig {
  street: string;
  city: string;
  state: string;
  zip: string;
  country: string;
}

export interface SocialLink {
  url: string;
  text: string;
}

/** Only include the networks you actually use; the rest are simply omitted. */
export interface SocialConfig {
  facebook?: SocialLink;
  instagram?: SocialLink;
  github?: SocialLink;
  twitter?: SocialLink;
  linkedin?: SocialLink;
  youtube?: SocialLink;
  tiktok?: SocialLink;
  telegram?: SocialLink;
  whatsapp?: SocialLink;
}

export interface ContactConfig {
  email: string;
  /** Human-readable phone, e.g. "(+54) 9 3442 550836". */
  phone: string;
  /** Dialable phone for `tel:` / WhatsApp links, e.g. "+5493442550836". */
  clickablePhone: string;
  address: AddressConfig;
  social: SocialConfig;
}

/**
 * User-facing copy strings that integrators may want to retext without editing
 * components. Kept structured (not full i18n) — single language per deployment.
 */
export interface CopyConfig {
  hero: {
    /** Big headline (defaults to the brand name if omitted at the call site). */
    title: string;
    /** Text before the animated keyword, e.g. "un espacio de". */
    subtitlePrefix: string;
    /** Rotating keywords animated in the hero. */
    keywords: string[];
    /** Supporting paragraph under the headline. */
    description: string;
  };
  footerTagline: string;
}

/** Per-module on/off switch plus opaque module-specific settings. */
export interface ModuleSettings {
  enabled: boolean;
  /** Module-specific settings, validated by the module's own Zod schema. */
  config?: Record<string, unknown>;
}

export type ModulesConfig = Record<string, ModuleSettings>;

export interface AppConfig {
  brand: BrandConfig;
  contact: ContactConfig;
  copy: CopyConfig;
  /** Enable/disable and configure modules (built-in or third-party). */
  modules: ModulesConfig;
}

/** Identity helper for authoring `app.config.ts` with full type-checking + inference. */
export function defineAppConfig(config: AppConfig): AppConfig {
  return config;
}
