import Breakout from "@/components/atoms/breakout";
import Container from "@/components/atoms/container";
import { LandingCard } from "@/components/templates/landing/shared/landing-card";
import {
  Building2,
  Eye,
  Globe2,
  GraduationCap,
  Heart,
  Landmark,
  LineChart,
  type LucideIcon,
  Rocket,
  Share2,
  Target,
  Users,
  Zap,
} from "lucide-react";
import Image from "next/image";

const TINT = "bg-la-nube-accent/40 dark:bg-la-nube-selected/15";

const VALORES = [
  "Innovación",
  "Cooperación",
  "Desarrollo sostenible",
  "Inclusión digital",
  "Competitividad global",
  "Impacto social",
];

const HELICES: { icon: LucideIcon; title: string; description: string }[] = [
  {
    icon: Landmark,
    title: "Estado",
    description:
      "Crea las condiciones institucionales e infraestructurales que hacen posible el ecosistema.",
  },
  {
    icon: GraduationCap,
    title: "Academia",
    description:
      "Genera, divulga y transfiere el conocimiento, y forma el talento de la región.",
  },
  {
    icon: Rocket,
    title: "Industria",
    description:
      "Desarrolla, comercializa y aplica la innovación, e impulsa la producción y el escalamiento.",
  },
  {
    icon: Users,
    title: "Sociedad civil",
    description:
      "Impulsa la inclusión digital, demanda conocimiento y sostiene el talento humano de alto nivel.",
  },
];

const HORIZONTES = [
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

const OBJETIVOS: { icon: LucideIcon; title: string; description: string }[] = [
  {
    icon: Globe2,
    title: "Competitividad e internacionalización",
    description:
      "Fortalecer el entramado productivo y proyectarlo hacia mercados globales.",
  },
  {
    icon: Share2,
    title: "Gobernanza del ecosistema",
    description:
      "Articular a los actores del territorio en torno a agendas comunes.",
  },
  {
    icon: GraduationCap,
    title: "Talento humano local",
    description:
      "Desarrollar, retener y atraer las capacidades digitales de la región.",
  },
  {
    icon: Zap,
    title: "Aceleración de proyectos",
    description:
      "Impulsar la creación y el escalamiento de emprendimientos tecnológicos.",
  },
  {
    icon: Building2,
    title: "Modernización urbana",
    description:
      "Poner la tecnología al servicio de una gestión pública más eficiente.",
  },
  {
    icon: LineChart,
    title: "Inteligencia territorial",
    description:
      "Anticipar tendencias y monitorear la evolución del Polo con datos.",
  },
];

/** Brand gradient accent word — the landing's signature heading treatment. */
function GradientWord({ children }: { children: React.ReactNode }) {
  return (
    <span className="bg-linear-to-r from-la-nube-primary to-la-nube-secondary bg-clip-text text-transparent">
      {children}
    </span>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-la-nube-primary/30 bg-la-nube-accent/40 px-3 py-1 font-mono text-xs font-medium uppercase tracking-wide text-la-nube-selected dark:bg-la-nube-selected/20 dark:text-la-nube-secondary">
      {children}
    </span>
  );
}

/** Landing-style section header — always left-aligned for a consistent rhythm. */
function SectionHeader({
  eyebrow,
  heading,
  lead,
  id,
}: {
  eyebrow: string;
  heading: React.ReactNode;
  lead?: string;
  id?: string;
}) {
  return (
    <div className="flex flex-col gap-3">
      <span className="font-mono text-sm font-medium uppercase tracking-[0.2em] text-la-nube-selected dark:text-la-nube-secondary">
        ~/ {eyebrow}
        <span className="animate-blink">▌</span>
      </span>
      <h2
        id={id}
        className="text-4xl font-bold md:text-5xl"
        style={{ textWrap: "balance" } as React.CSSProperties}
      >
        {heading}
      </h2>
      {lead && (
        <p className="max-w-prose text-lg text-muted-foreground text-pretty">
          {lead}
        </p>
      )}
    </div>
  );
}

export default function AboutPage() {
  return (
    <div className="flex flex-col w-full">
      {/* Hero — transparent so the particle field shows through, like the landing. */}
      <section className="flex flex-col items-center gap-6 py-20 text-center md:py-28">
        <div className="animate-fade-up flex flex-wrap items-center justify-center gap-2">
          <Pill>Inaugurado · 25 sept 2025</Pill>
          <Pill>Plan 2026–2030</Pill>
        </div>
        <h1
          className="animate-fade-up text-4xl font-bold tracking-tight text-balance md:text-6xl"
          style={{ animationDelay: "80ms" }}
        >
          Quiénes <GradientWord>somos</GradientWord>
        </h1>
        <p
          className="animate-fade-up max-w-prose text-base text-pretty lg:text-xl"
          style={{ animationDelay: "160ms" }}
        >
          El Polo Tecnológico La Nube es el espacio de innovación de Concepción
          del Uruguay: el punto de encuentro entre el talento, el sector
          productivo, las universidades, el Estado y la sociedad civil, donde
          nacen soluciones tecnológicas que impulsan el desarrollo económico y
          social de la región.
        </p>
      </section>

      {/* Qué es La Nube */}
      <section className="flex flex-col gap-8 border-t border-la-nube-primary/15 py-16 md:py-20">
        <SectionHeader
          eyebrow="institución"
          heading={
            <>
              Qué es <GradientWord>La Nube</GradientWord>
            </>
          }
        />
        <div className="flex flex-col gap-8 md:flex-row md:items-start">
          <div className="flex w-full max-w-prose flex-col gap-4">
            <p>
              El <b>Polo Tecnológico La Nube</b>, inaugurado el{" "}
              <b>25 de septiembre de 2025</b>, es una iniciativa estratégica del
              Gobierno Municipal de Concepción del Uruguay para liderar el
              desarrollo de la <b>Economía del Conocimiento</b> en la región.
            </p>
            <p>
              Se financia con recursos municipales y articula a las empresas de{" "}
              <b>Software y Servicios Informáticos (SSI)</b> nucleadas en la
              Cámara de la Industria del Software de Concepción del Uruguay
              (CISCU), junto a las universidades e instituciones de I+D+i de la
              ciudad.
            </p>
            <p>
              Esta convergencia de actores posiciona al Polo como un instrumento
              clave para fortalecer las capacidades competitivas del sector a
              escala global, impulsar la generación de empleo calificado y
              promover el desarrollo económico local basado en la tecnología.
            </p>
          </div>
          <div className="w-full overflow-hidden rounded-2xl border shadow-sm md:max-w-md">
            <Image
              src="/images/stock/coworking.webp"
              alt="Espacio de coworking del Polo Tecnológico La Nube"
              width={1024}
              height={1024}
              className="h-auto w-full object-cover"
            />
          </div>
        </div>
      </section>

      {/* El desafío — the "why" (tinted feature). */}
      <Breakout className={TINT}>
        <Container>
          <section className="flex flex-col gap-6 py-16 md:py-20">
            <SectionHeader
              eyebrow="desafío"
              heading={
                <>
                  El <GradientWord>desafío</GradientWord>
                </>
              }
            />
            <div className="flex max-w-prose flex-col gap-4">
              <p>
                Concepción del Uruguay produce talento tecnológico de primer
                nivel. Hoy, una masa crítica de profesionales altamente
                calificados trabaja de forma remota para{" "}
                <b>más de 30 empresas del exterior</b>: el valor se genera acá,
                pero se aprovecha afuera.
              </p>
              <p className="text-xl font-medium text-balance">
                <b>La Nube existe para cambiar eso.</b> Para convertir ese
                capital intelectual en un motor de desarrollo endógeno que
                arraigue la innovación, cree empresas y empleo local, y
                transforme el tejido productivo de la ciudad y la región.
              </p>
            </div>
          </section>
        </Container>
      </Breakout>

      {/* La Nube en números */}
      <section className="flex flex-col gap-8 border-t border-la-nube-primary/15 py-16 md:py-20">
        <SectionHeader
          eyebrow="cifras"
          heading={
            <>
              La Nube en <GradientWord>números</GradientWord>
            </>
          }
          lead="El ecosistema educativo y tecnológico de Concepción del Uruguay, en datos (2026)."
        />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatTile data="4" title="Universidades · UNER, UCU, UTN y UADER" />
          <StatTile data="+130" title="Carreras superiores" />
          <StatTile data="+250" title="Profesionales SSI" />
          <StatTile data="+25" title="Empresas SSI con representación local" />
        </div>
      </section>

      {/* El origen — the official logo legend (tinted feature). */}
      <Breakout className={TINT}>
        <Container>
          <section className="flex animate-fade-up flex-col gap-8 py-16 md:py-24">
            <SectionHeader
              eyebrow="origen"
              heading={
                <>
                  La leyenda del <GradientWord>logo</GradientWord>
                </>
              }
              lead="Cómo nació La Nube, contada en los trazos de su marca."
            />
            <div className="flex max-w-3xl flex-col gap-6">
              <p className="text-2xl font-bold tracking-tight text-balance md:text-3xl">
                En Concepción del Uruguay, una nube decidió quedarse. No estaba
                hecha de vapor, sino de encuentros.
              </p>
              <p className="text-base leading-relaxed text-pretty md:text-lg md:leading-relaxed">
                El primer trazo nació cuando el{" "}
                <b className="font-semibold text-la-nube-primary">Estado</b>{" "}
                dijo «hagámoslo posible». El segundo, cuando la{" "}
                <b className="font-semibold text-la-nube-primary">Academia</b>{" "}
                dijo «hagámoslo saber». El tercero, cuando la{" "}
                <b className="font-semibold text-la-nube-primary">
                  Industria y el emprendimiento
                </b>{" "}
                dijeron «hagámoslo realidad».
              </p>
              <p className="text-xl font-medium text-balance md:text-2xl">
                Al unirse, los trazos dibujaron una nube: un espacio común donde
                las ideas se condensan hasta llover oportunidades.
              </p>
              <p className="text-base leading-relaxed text-pretty md:text-lg md:leading-relaxed">
                Luego llegaron los nodos —
                <b>personas, pymes, universidades, organismos y escuelas</b>—:
                los actores que le dan fuerza al Polo y representan el camino
                que queremos construir juntos.
              </p>
            </div>
          </section>
        </Container>
      </Breakout>

      {/* Un ecosistema de cuatro hélices */}
      <section className="flex flex-col gap-8 border-t border-la-nube-primary/15 py-16 md:py-20">
        <SectionHeader
          eyebrow="ecosistema"
          heading={
            <>
              Un ecosistema de cuatro <GradientWord>hélices</GradientWord>
            </>
          }
          lead="La Nube se construye sobre el encuentro de cuatro actores. Cada uno aporta una parte, y ninguno alcanza por sí solo."
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {HELICES.map((helice) => (
            <HelixCard key={helice.title} {...helice} />
          ))}
        </div>
      </section>

      {/* Plan 2026–2030 */}
      <section className="flex flex-col gap-10 border-t border-la-nube-primary/15 py-16 md:py-20">
        <SectionHeader
          eyebrow="hoja de ruta"
          heading={
            <>
              Plan <GradientWord>2026–2030</GradientWord>
            </>
          }
          lead="Una hoja de ruta en tres horizontes para consolidar al Polo como ecosistema de innovación regional."
        />
        <div className="grid gap-4 md:grid-cols-3">
          {HORIZONTES.map((h) => (
            <HorizonCard key={h.step} {...h} />
          ))}
        </div>
        <div className="flex flex-col gap-4">
          <h3 className="text-xl font-bold">Seis objetivos estratégicos</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {OBJETIVOS.map((o) => (
              <ObjetivoCard key={o.title} {...o} />
            ))}
          </div>
        </div>
      </section>

      {/* Misión, Visión y Valores (tinted close). */}
      <Breakout className={TINT}>
        <Container>
          <section className="flex flex-col gap-8 py-16 md:py-24">
            <SectionHeader
              eyebrow="identidad"
              heading={
                <>
                  Misión, Visión y <GradientWord>Valores</GradientWord>
                </>
              }
            />
            <div className="grid gap-4 md:grid-cols-3">
              <InfoTile icon={Target} title="Misión">
                <p>
                  Acelerar el desarrollo productivo regional mediante un marco
                  de gobernanza y gestión del conocimiento territorial,
                  interactivo y estratégico, transformando el{" "}
                  <b>talento local en soluciones tecnológicas</b> de alto valor
                  competitivo para el mercado nacional e internacional. Fomentar
                  la innovación, la creación y dinamización de empresas de base
                  tecnológica con perfil exportador y la inclusión digital.
                </p>
              </InfoTile>
              <InfoTile icon={Eye} title="Visión">
                <p>
                  Ser el <b>nodo referente en la región</b> en Economía del
                  Conocimiento, reconocido por su ecosistema de innovación
                  sostenible y su desarrollo de talento competitivo.
                </p>
              </InfoTile>
              <InfoTile icon={Heart} title="Valores">
                <ul className="flex flex-col gap-2">
                  {VALORES.map((valor) => (
                    <li key={valor} className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-la-nube-primary" />
                      {valor}
                    </li>
                  ))}
                </ul>
              </InfoTile>
            </div>
          </section>
        </Container>
      </Breakout>
    </div>
  );
}

/** Terminal-style stat tile — echoes the landing space-card's capacity box. */
function StatTile({ data, title }: { data: string; title: string }) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border-2 border-la-nube-primary/20 bg-card/60 p-6">
      <span className="text-4xl font-black text-la-nube-primary md:text-6xl">
        {data}
      </span>
      <div className="h-px w-full bg-la-nube-primary/15" />
      <span className="text-sm font-semibold text-foreground/80">{title}</span>
    </div>
  );
}

/** Hélice tile — landing card treatment with the bracket + brand-icon language. */
function HelixCard({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <LandingCard>
      <div className="flex h-full flex-col gap-3 p-6">
        <Icon className="size-10 stroke-2 stroke-la-nube-secondary" />
        <h3 className="text-2xl font-bold leading-snug">[ {title} ]</h3>
        <div className="h-px w-full bg-muted-foreground/30" />
        <p className="text-sm text-foreground/80">{description}</p>
      </div>
    </LandingCard>
  );
}

/** Roadmap horizon — an ordered sequence, so the numbered marker is earned. */
function HorizonCard({
  step,
  phase,
  title,
  description,
}: {
  step: string;
  phase: string;
  title: string;
  description: string;
}) {
  return (
    <LandingCard>
      <div className="flex h-full flex-col gap-3 p-6">
        <div className="flex items-baseline justify-between">
          <span className="font-mono text-sm font-medium uppercase tracking-wide text-la-nube-selected dark:text-la-nube-secondary">
            {phase}
          </span>
          <span className="font-mono text-2xl font-black text-la-nube-primary/30">
            {step}
          </span>
        </div>
        <div className="h-px w-full bg-muted-foreground/30" />
        <h3 className="text-xl font-bold leading-snug">{title}</h3>
        <p className="text-sm text-foreground/80">{description}</p>
      </div>
    </LandingCard>
  );
}

/** Objetivo estratégico — compact bordered tile (non-interactive, no hover lift). */
function ObjetivoCard({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border-2 border-la-nube-primary/20 bg-card/60 p-5">
      <Icon className="size-6 shrink-0 stroke-2 stroke-la-nube-secondary" />
      <div className="flex flex-col gap-1">
        <h4 className="font-bold leading-snug">{title}</h4>
        <p className="text-sm text-foreground/80">{description}</p>
      </div>
    </div>
  );
}

/** Misión / Visión tile — same landing card language. */
function InfoTile({
  icon: Icon,
  title,
  children,
}: {
  icon: LucideIcon;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <LandingCard>
      <div className="flex h-full w-full flex-col gap-4 p-6">
        <div className="flex items-center gap-3">
          <Icon className="size-8 stroke-2 stroke-la-nube-secondary" />
          <h3 className="text-2xl font-bold">[ {title} ]</h3>
        </div>
        <div className="h-px w-full bg-muted-foreground/30" />
        {children}
      </div>
    </LandingCard>
  );
}
