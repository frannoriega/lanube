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
import { IsologoInView } from "@/components/atoms/logos/lanube/isologo-in-view";
import { ParallaxImage } from "@/components/molecules/parallax-image";
import { SectionHeading } from "@/components/templates/landing/shared/section-heading";
import { StatsBand } from "@/components/templates/landing/stats";
import {
  ABOUT_BADGES,
  ABOUT_CHALLENGE,
  ABOUT_HELICES,
  ABOUT_HELICES_LEAD,
  ABOUT_HERO_LEAD,
  ABOUT_HORIZONS,
  ABOUT_LEGEND,
  ABOUT_MISSION,
  ABOUT_OBJECTIVES,
  ABOUT_PLAN_LEAD,
  ABOUT_VALUES,
  ABOUT_VISION,
  ABOUT_WHAT_IS,
} from "@/lib/about/content";

const TINT = "bg-la-nube-accent/40 dark:bg-la-nube-selected/15";

/**
 * Íconos de las tarjetas, en el mismo orden que sus textos en `@/lib/about/content` (el texto
 * vive allá porque también lo lee el conector MCP; los íconos son solo de esta página).
 */
const HELIX_ICONS: LucideIcon[] = [Landmark, GraduationCap, Rocket, Users];
const OBJECTIVE_ICONS: LucideIcon[] = [
  Globe2,
  Share2,
  GraduationCap,
  Zap,
  Building2,
  LineChart,
];

/**
 * Renderiza un texto de `@/lib/about/content` convirtiendo `**así**` en `<b>`. `boldClassName`
 * le da estilo propio a las negritas (la leyenda colorea los tres actores).
 */
function Emphasis({
  text,
  boldClassName,
}: {
  text: string;
  boldClassName?: string;
}) {
  return (
    <>
      {text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
        part.startsWith("**") && part.endsWith("**") ? (
          <b key={i} className={boldClassName}>
            {part.slice(2, -2)}
          </b>
        ) : (
          part
        ),
      )}
    </>
  );
}

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

/**
 * Encabezado de sección de esta página: el `SectionHeading` compartido con la landing (desde el
 * milestone 18, títulos en azul noche). `heading` ya trae su palabra en degradé.
 */
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
    <SectionHeading eyebrow={eyebrow} title={heading} lead={lead} id={id} />
  );
}

export default function AboutPage() {
  return (
    <div className="flex flex-col w-full">
      {/* Hero — transparent so the particle field shows through, like the landing. */}
      <section className="flex flex-col items-center gap-6 py-20 text-center md:py-28">
        <div className="animate-fade-up flex flex-wrap items-center justify-center gap-2">
          {ABOUT_BADGES.map((b) => (
            <Pill key={b}>{b}</Pill>
          ))}
        </div>
        <h1
          className="animate-fade-up text-4xl font-bold tracking-tight text-balance text-la-nube-ink md:text-6xl dark:text-white"
          style={{ animationDelay: "80ms" }}
        >
          Quiénes <GradientWord>somos</GradientWord>
        </h1>
        <p
          className="animate-fade-up max-w-prose text-base text-pretty lg:text-xl"
          style={{ animationDelay: "160ms" }}
        >
          {ABOUT_HERO_LEAD}
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
            {ABOUT_WHAT_IS.map((p) => (
              <p key={p}>
                <Emphasis text={p} />
              </p>
            ))}
          </div>
          <ParallaxImage
            src="/images/stock/coworking.webp"
            alt="Espacio de coworking del Polo Tecnológico La Nube"
            sizes="(min-width: 768px) 28rem, 100vw"
            className="aspect-[4/3] w-full rounded-2xl border shadow-lg md:max-w-md"
          />
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
              {ABOUT_CHALLENGE.paragraphs.map((p) => (
                <p key={p}>
                  <Emphasis text={p} />
                </p>
              ))}
              <p className="text-xl font-medium text-balance">
                <Emphasis text={ABOUT_CHALLENGE.closing} />
              </p>
            </div>
          </section>
        </Container>
      </Breakout>

      {/* El ecosistema en números — transparente entre dos secciones tintadas (ver `StatsBand`). */}
      <StatsBand />

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
              lead={ABOUT_LEGEND.lead}
            />
            <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_20rem]">
              {/* El logo se dibuja en el orden del relato: trazos, conectores, nodos. */}
              <IsologoInView className="mx-auto w-48 sm:w-60 lg:order-2 lg:w-full" />
              <div className="flex max-w-3xl flex-col gap-6">
                <p className="text-2xl font-bold tracking-tight text-balance md:text-3xl">
                  {ABOUT_LEGEND.opening}
                </p>
                <p className="text-base leading-relaxed text-pretty md:text-lg md:leading-relaxed">
                  <Emphasis
                    text={ABOUT_LEGEND.strokes}
                    boldClassName="font-semibold text-la-nube-selected dark:text-la-nube-secondary"
                  />
                </p>
                <p className="text-xl font-medium text-balance md:text-2xl">
                  {ABOUT_LEGEND.cloud}
                </p>
                <p className="text-base leading-relaxed text-pretty md:text-lg md:leading-relaxed">
                  <Emphasis text={ABOUT_LEGEND.nodes} />
                </p>
              </div>
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
          lead={ABOUT_HELICES_LEAD}
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {ABOUT_HELICES.map((helice, i) => (
            <HelixCard key={helice.title} icon={HELIX_ICONS[i]} {...helice} />
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
          lead={ABOUT_PLAN_LEAD}
        />
        <div className="grid gap-4 md:grid-cols-3">
          {ABOUT_HORIZONS.map((h) => (
            <HorizonCard key={h.step} {...h} />
          ))}
        </div>
        <div className="flex flex-col gap-4">
          <h3 className="text-xl font-bold">Seis objetivos estratégicos</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {ABOUT_OBJECTIVES.map((o, i) => (
              <ObjetivoCard key={o.title} icon={OBJECTIVE_ICONS[i]} {...o} />
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
                  <Emphasis text={ABOUT_MISSION} />
                </p>
              </InfoTile>
              <InfoTile icon={Eye} title="Visión">
                <p>
                  <Emphasis text={ABOUT_VISION} />
                </p>
              </InfoTile>
              <InfoTile icon={Heart} title="Valores">
                <ul className="flex flex-col gap-2">
                  {ABOUT_VALUES.map((valor) => (
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
