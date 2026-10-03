import Breakout from "@/components/atoms/breakout";
import Container from "@/components/atoms/container";
import { Reveal } from "@/components/molecules/reveal";
import { SectionHeading } from "@/components/templates/landing/shared/section-heading";
import { ECOSYSTEM_STATS } from "@/lib/constants/ecosystem-stats";
import { CountUp } from "./count-up";

/**
 * Franja "El ecosistema en números" de "Quiénes somos" (milestone 18).
 *
 * Primera versión: un bloque azul noche sólido con resplandores, también en la landing entre
 * Eventos y Noticias. Se sacó de la landing tras revisarla con el usuario porque las cifras son de la
 * ciudad (universidades, carreras, profesionales y empresas SSI), no de La Nube — titularlas
 * "La Nube en números" en la portada prometía algo que no eran — y porque cortaba el recorrido
 * eventos → noticias sin aportar una acción. En "Quiénes somos" sí tienen contexto: siguen al
 * "desafío", que habla justamente de ese ecosistema.
 *
 * El estilo también cambió: el fondo sólido tapaba las partículas y no se parecía a ninguna
 * otra sección (y en modo claro era el único bloque oscuro de la página). Ahora el fondo es
 * transparente — entre las dos secciones tintadas que lo rodean, respeta la alternancia — y
 * los números usan el mismo degradé de marca que la palabra destacada de los títulos, con
 * `font-bold` como los títulos (antes `font-black` a 7xl, más pesado que todo lo demás).
 * Breakout → Container → section, igual que las demás secciones de "Quiénes somos", para que
 * el texto quede alineado con el de sus vecinas (antes llevaba el `px-8` de la landing).
 */
export function StatsBand({
  eyebrow = "cifras",
  lead = "Concepción del Uruguay, el ecosistema educativo y tecnológico en el que La Nube se apoya (2026).",
}: {
  eyebrow?: string;
  lead?: string;
}) {
  return (
    <Breakout>
      <Container>
        <section
          className="flex flex-col gap-10 py-16 md:py-20"
          aria-labelledby="ecosistema-en-numeros"
        >
          <SectionHeading
            eyebrow={eyebrow}
            title="El ecosistema en"
            accent="números"
            lead={lead}
            id="ecosistema-en-numeros"
          />
          <ul className="grid grid-cols-2 gap-x-6 gap-y-10 lg:grid-cols-4">
            {ECOSYSTEM_STATS.map((stat, i) => (
              <li key={stat.label}>
                <Reveal delay={i * 0.08}>
                  <div className="flex flex-col gap-2 border-l-2 border-la-nube-primary/30 pl-5">
                    <span className="w-fit bg-linear-to-r from-la-nube-primary to-la-nube-secondary bg-clip-text text-5xl font-bold tracking-tight text-transparent tabular-nums md:text-6xl">
                      <CountUp value={stat.value} prefix={stat.prefix} />
                    </span>
                    <span className="text-sm font-medium text-muted-foreground md:text-base">
                      {stat.label}
                    </span>
                  </div>
                </Reveal>
              </li>
            ))}
          </ul>
        </section>
      </Container>
    </Breakout>
  );
}
