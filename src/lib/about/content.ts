import { ECOSYSTEM_STATS } from "@/lib/constants/ecosystem-stats";

/**
 * Contenido de "Quiénes somos" (`/about`) como **datos**: la única fuente del texto
 * institucional de esa página. Lo renderiza la página (con su diseño) y lo devuelve en
 * markdown la tool `get_about` del conector MCP (milestone 21), así lo que lee un asistente es
 * exactamente lo publicado y no una copia que se desactualiza.
 *
 * Convención: los textos pueden marcar énfasis con `**negrita**`; la página lo convierte en
 * `<b>` (`Emphasis` en `about/page.tsx`) y el markdown lo deja tal cual. Nada más que eso: si
 * hace falta otro formato, se agrega acá y en los dos lugares que lo leen.
 *
 * Fuente autoritativa del copy institucional: el Plan Estratégico (ver `assets/`).
 */

export const ABOUT_BADGES = ["Inaugurado · 25 sept 2025", "Plan 2026–2030"];

export const ABOUT_HERO_LEAD =
  "El Polo Tecnológico La Nube es el espacio de innovación de Concepción del Uruguay: el punto de encuentro entre el talento, el sector productivo, las universidades, el Estado y la sociedad civil, donde nacen soluciones tecnológicas que impulsan el desarrollo económico y social de la región.";

export const ABOUT_WHAT_IS = [
  "El **Polo Tecnológico La Nube**, inaugurado el **25 de septiembre de 2025**, es una iniciativa estratégica del Gobierno Municipal de Concepción del Uruguay para liderar el desarrollo de la **Economía del Conocimiento** en la región.",
  "Se financia con recursos municipales y articula a las empresas de **Software y Servicios Informáticos (SSI)** nucleadas en la Cámara de la Industria del Software de Concepción del Uruguay (CISCU), junto a las universidades e instituciones de I+D+i de la ciudad.",
  "Esta convergencia de actores posiciona al Polo como un instrumento clave para fortalecer las capacidades competitivas del sector a escala global, impulsar la generación de empleo calificado y promover el desarrollo económico local basado en la tecnología.",
];

export const ABOUT_CHALLENGE = {
  paragraphs: [
    "Concepción del Uruguay produce talento tecnológico de primer nivel. Hoy, una masa crítica de profesionales altamente calificados trabaja de forma remota para **más de 30 empresas del exterior**: el valor se genera acá, pero se aprovecha afuera.",
  ],
  /** El cierre destacado de la sección. */
  closing:
    "**La Nube existe para cambiar eso.** Para convertir ese capital intelectual en un motor de desarrollo endógeno que arraigue la innovación, cree empresas y empleo local, y transforme el tejido productivo de la ciudad y la región.",
};

/** La leyenda del logo. `strokes` lleva los tres actores en negrita (la página los colorea). */
export const ABOUT_LEGEND = {
  lead: "Cómo nació La Nube, contada en los trazos de su marca.",
  opening:
    "En Concepción del Uruguay, una nube decidió quedarse. No estaba hecha de vapor, sino de encuentros.",
  strokes:
    "El primer trazo nació cuando el **Estado** dijo «hagámoslo posible». El segundo, cuando la **Academia** dijo «hagámoslo saber». El tercero, cuando la **Industria y el emprendimiento** dijeron «hagámoslo realidad».",
  cloud:
    "Al unirse, los trazos dibujaron una nube: un espacio común donde las ideas se condensan hasta llover oportunidades.",
  nodes:
    "Luego llegaron los nodos —**personas, pymes, universidades, organismos y escuelas**—: los actores que le dan fuerza al Polo y representan el camino que queremos construir juntos.",
};

export const ABOUT_HELICES_LEAD =
  "La Nube se construye sobre el encuentro de cuatro actores. Cada uno aporta una parte, y ninguno alcanza por sí solo.";

export const ABOUT_HELICES = [
  {
    title: "Estado",
    description:
      "Crea las condiciones institucionales e infraestructurales que hacen posible el ecosistema.",
  },
  {
    title: "Academia",
    description:
      "Genera, divulga y transfiere el conocimiento, y forma el talento de la región.",
  },
  {
    title: "Industria",
    description:
      "Desarrolla, comercializa y aplica la innovación, e impulsa la producción y el escalamiento.",
  },
  {
    title: "Sociedad civil",
    description:
      "Impulsa la inclusión digital, demanda conocimiento y sostiene el talento humano de alto nivel.",
  },
];

export const ABOUT_PLAN_LEAD =
  "Una hoja de ruta en tres horizontes para consolidar al Polo como ecosistema de innovación regional.";

export const ABOUT_HORIZONS = [
  {
    step: "01",
    phase: "2026",
    title: "Consolidación institucional",
    description:
      "Construcción de la gobernanza, el marco normativo y la infraestructura inicial.",
  },
  {
    step: "02",
    phase: "2027–2028",
    title: "Escalamiento y profesionalización",
    description:
      "Desarrollo de programas de innovación, incubación y exportación tecnológica.",
  },
  {
    step: "03",
    phase: "2029–2030",
    title: "Posicionamiento regional e internacional",
    description:
      "Integración del Polo a redes de innovación nacionales e internacionales.",
  },
];

export const ABOUT_OBJECTIVES = [
  {
    title: "Competitividad e internacionalización",
    description:
      "Fortalecer el entramado productivo y proyectarlo hacia mercados globales.",
  },
  {
    title: "Gobernanza del ecosistema",
    description:
      "Articular a los actores del territorio en torno a agendas comunes.",
  },
  {
    title: "Talento humano local",
    description:
      "Desarrollar, retener y atraer las capacidades digitales de la región.",
  },
  {
    title: "Aceleración de proyectos",
    description:
      "Impulsar la creación y el escalamiento de emprendimientos tecnológicos.",
  },
  {
    title: "Modernización urbana",
    description:
      "Poner la tecnología al servicio de una gestión pública más eficiente.",
  },
  {
    title: "Inteligencia territorial",
    description:
      "Anticipar tendencias y monitorear la evolución del Polo con datos.",
  },
];

export const ABOUT_MISSION =
  "Acelerar el desarrollo productivo regional mediante un marco de gobernanza y gestión del conocimiento territorial, interactivo y estratégico, transformando el **talento local en soluciones tecnológicas** de alto valor competitivo para el mercado nacional e internacional. Fomentar la innovación, la creación y dinamización de empresas de base tecnológica con perfil exportador y la inclusión digital.";

export const ABOUT_VISION =
  "Ser el **nodo referente en la región** en Economía del Conocimiento, reconocido por su ecosistema de innovación sostenible y su desarrollo de talento competitivo.";

export const ABOUT_VALUES = [
  "Innovación",
  "Cooperación",
  "Desarrollo sostenible",
  "Inclusión digital",
  "Competitividad global",
  "Impacto social",
];

/**
 * Toda la página en markdown, en el orden en que se lee. Es lo que devuelve la tool MCP
 * `get_about`. Las cifras del ecosistema van aclaradas como **de la ciudad**, no de La Nube
 * (la misma distinción que hizo sacarlas de la landing en el milestone 18).
 */
export function aboutAsMarkdown(): string {
  const stats = ECOSYSTEM_STATS.map(
    (s) => `- ${s.prefix ?? ""}${s.value} ${s.label}`,
  ).join("\n");
  return [
    "# Quiénes somos — Polo Tecnológico La Nube",
    ABOUT_BADGES.join(" · "),
    ABOUT_HERO_LEAD,
    "## Qué es La Nube",
    ...ABOUT_WHAT_IS,
    "## El desafío",
    ...ABOUT_CHALLENGE.paragraphs,
    ABOUT_CHALLENGE.closing,
    "## El ecosistema en números (cifras de Concepción del Uruguay, no de La Nube)",
    stats,
    "## La leyenda del logo",
    ABOUT_LEGEND.lead,
    ABOUT_LEGEND.opening,
    ABOUT_LEGEND.strokes,
    ABOUT_LEGEND.cloud,
    ABOUT_LEGEND.nodes,
    "## Un ecosistema de cuatro hélices",
    ABOUT_HELICES_LEAD,
    ABOUT_HELICES.map((h) => `- **${h.title}:** ${h.description}`).join("\n"),
    "## Plan 2026–2030",
    ABOUT_PLAN_LEAD,
    ABOUT_HORIZONS.map(
      (h) => `${h.step}. **${h.title}** (${h.phase}): ${h.description}`,
    ).join("\n"),
    "### Seis objetivos estratégicos",
    ABOUT_OBJECTIVES.map((o) => `- **${o.title}:** ${o.description}`).join(
      "\n",
    ),
    "## Misión",
    ABOUT_MISSION,
    "## Visión",
    ABOUT_VISION,
    "## Valores",
    ABOUT_VALUES.map((v) => `- ${v}`).join("\n"),
  ].join("\n\n");
}
