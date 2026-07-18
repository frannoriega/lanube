import { getBrand } from "@/config";

/**
 * Injects the configured brand colors as `--color-brand-*` CSS variables at the top
 * of <body>. Because this renders after globals.css, these values override the
 * defaults baked into the stylesheet — so Tailwind utilities (bg-brand-primary, …)
 * follow whatever colors app.config.ts declares, with zero CSS edits to rebrand.
 */
export default function BrandThemeStyle() {
  const { theme } = getBrand();
  const css = `:root{--color-brand-primary:${theme.primary};--color-brand-selected:${theme.selected};--color-brand-secondary:${theme.secondary};--color-brand-accent:${theme.accent};}`;
  return (
    <style id="brand-theme-vars" dangerouslySetInnerHTML={{ __html: css }} />
  );
}
