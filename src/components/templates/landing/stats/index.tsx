import Breakout from "@/components/atoms/breakout";
import Container from "@/components/atoms/container";
import { Reveal } from "@/components/molecules/reveal";
import { SectionHeading } from "@/components/templates/landing/shared/section-heading";
import { ECOSYSTEM_STATS } from "@/lib/constants/ecosystem-stats";
import { CountUp } from "./count-up";

/**
 * Franja oscura "La Nube en números" (milestone 17). Es la ruptura de ritmo de la landing:
 * todas las demás secciones son fondo claro + tarjetas, ésta es un bloque azul noche a todo el
 * ancho con cifras grandes en cian, para que la página no sea una sucesión de bloques iguales.
 * También se usa en "Quiénes somos" (mismo componente, mismas cifras).
 *
 * El fondo es sólido (tapa las partículas a propósito) con dos resplandores radiales de marca
 * para que no se vea como un rectángulo plano. Como pinta su propio fondo, no usa
 * `LANDING_SECTION_BG`; igual cuenta como un hijo más del contenedor de secciones, y la
 * alternancia de las demás sigue bien porque ninguna queda pegada a otra del mismo tono.
 */
export function StatsBand({
  eyebrow = "cifras",
  lead = "El ecosistema educativo y tecnológico de Concepción del Uruguay, en datos (2026).",
}: {
  eyebrow?: string;
  lead?: string;
}) {
  return (
    <Breakout className="relative overflow-hidden bg-la-nube-night text-white">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_80%_at_10%_0%,rgba(78,135,194,0.35),transparent_60%),radial-gradient(50%_70%_at_95%_100%,rgba(117,227,241,0.18),transparent_60%)]"
      />
      <section className="relative w-full" aria-labelledby="la-nube-en-numeros">
        <Container className="flex flex-col gap-10 px-8 py-16 md:py-20">
          <SectionHeading
            tone="inverse"
            eyebrow={eyebrow}
            title="La Nube en"
            accent="números"
            lead={lead}
            id="la-nube-en-numeros"
          />
          <ul className="grid grid-cols-2 gap-x-6 gap-y-10 lg:grid-cols-4">
            {ECOSYSTEM_STATS.map((stat, i) => (
              <li key={stat.label}>
                <Reveal delay={i * 0.08}>
                  <div className="flex flex-col gap-3 border-l-2 border-la-nube-secondary/60 pl-5">
                    <span className="text-5xl font-black tracking-tight text-la-nube-secondary tabular-nums md:text-7xl">
                      <CountUp value={stat.value} prefix={stat.prefix} />
                    </span>
                    <span className="text-sm font-medium text-white/80 md:text-base">
                      {stat.label}
                    </span>
                  </div>
                </Reveal>
              </li>
            ))}
          </ul>
        </Container>
      </section>
    </Breakout>
  );
}
