"use client";

import Breakout from "@/components/atoms/breakout";
import Container from "@/components/atoms/container";
import { LANDING_SECTION_BG } from "@/components/templates/landing/shared/section-bg";
import { LogoCard } from "@/components/molecules/logo-card";
import { Marquee } from "@/components/molecules/marquee";
import { useViewportWidth } from "@/hooks/use-viewport-width";
import { partners } from "@/lib/constants/partners";

const MOBILE_BREAKPOINT = 768;

export default function PartnersSection() {
  const viewportWidth = useViewportWidth();
  const gradientWidth =
    viewportWidth !== undefined
      ? viewportWidth < MOBILE_BREAKPOINT
        ? 40
        : 120
      : 120;

  return (
    <Breakout className={LANDING_SECTION_BG}>
      <section className="w-full flex flex-col items-center">
        <Container className="px-8 py-16 gap-8 flex flex-col">
          <div className="flex flex-col gap-3">
            <span className="font-mono text-sm font-medium uppercase tracking-[0.2em] text-la-nube-selected dark:text-la-nube-secondary">
              ~/ socios
              <span className="animate-blink">▌</span>
            </span>
            <h2 id="nuestros-socios" className="text-5xl font-bold">
              Nuestros{" "}
              <span className="bg-linear-to-r from-la-nube-primary to-la-nube-secondary bg-clip-text text-transparent">
                socios
              </span>
            </h2>
            <p className="max-w-prose text-lg text-muted-foreground">
              Empresas y organizaciones que confían en nosotros y forman parte
              de nuestro ecosistema
            </p>
          </div>
          <div className="w-full flex flex-row">
            <Marquee
              direction="right"
              gradientWidth={gradientWidth}
              speed={50}
              pauseOnHover
              className="py-4"
            >
              {partners.map((partner) => (
                <LogoCard
                  key={partner.id}
                  name={partner.name}
                  img={partner.img}
                  url={partner.url}
                />
              ))}
            </Marquee>
          </div>
        </Container>
      </section>
    </Breakout>
  );
}
