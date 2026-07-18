import LogoLaNube from "@/components/atoms/logos/lanube";
import { defineAppConfig } from "@/config/types";

/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  APP CONFIG — the single file you edit to rebrand this platform.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Change the brand name/logo/colors/contact/copy below and the whole app follows.
 * Enable or disable features under `modules`. See docs/WHITELABEL.md for details.
 *
 * A few fields can be overridden per-environment via `NEXT_PUBLIC_*` env vars
 * (see src/config/index.ts): brand name/tagline/description and contact email.
 */
export default defineAppConfig({
  brand: {
    name: "La Nube",
    shortName: "La Nube",
    tagline: "Polo Tecnológico",
    description: 'Espacio de coworking e innovación "La Nube"',
    logo: LogoLaNube,
    theme: {
      primary: "#4e87c2",
      selected: "#2a6297",
      secondary: "#75e3f1",
      accent: "#c8f1fc",
    },
    themeStorageKey: "la-nube-theme",
  },

  contact: {
    email: "polotecnologicolanube@gmail.com",
    phone: "(+54) 9 3442 550836",
    clickablePhone: "+5493442550836",
    address: {
      street: "Posadas 1150",
      city: "Concepción del Uruguay",
      state: "Entre Ríos",
      zip: "3260",
      country: "Argentina",
    },
    social: {
      instagram: {
        url: "https://www.instagram.com/lanubepolotec",
        text: "lanubepolotec",
      },
      github: {
        url: "https://github.com/frannoriega/lanube",
        text: "lanube",
      },
    },
  },

  copy: {
    hero: {
      title: "La Nube",
      subtitlePrefix: "un espacio de",
      keywords: [
        "innovación",
        "talento",
        "conocimiento",
        "aprendizaje",
        "colaboración",
        "creación",
      ],
      description:
        "Impulsamos la Economía del Conocimiento en nuestra ciudad, conectando empresas, universidades, emprendedores y sector público para transformar el futuro.",
    },
    footerTagline: "polo tecnológico",
  },

  modules: {
    events: { enabled: true },
    news: { enabled: false }, // future newsletter module — see src/modules/news
  },
});
