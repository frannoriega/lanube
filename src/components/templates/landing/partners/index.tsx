"use client";

import Breakout from "@/components/atoms/breakout";
import Container from "@/components/atoms/container";
import { LANDING_SECTION_BG } from "@/components/templates/landing/shared/section-bg";
import { SectionHeading } from "@/components/templates/landing/shared/section-heading";
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
      <section
        className="w-full flex flex-col items-center"
        aria-labelledby="nuestros-socios"
      >
        <Container className="px-8 py-16 gap-8 flex flex-col">
          <SectionHeading
            eyebrow="socios"
            title="Nuestros"
            accent="socios"
            lead="Empresas y organizaciones que confían en nosotros y forman parte de nuestro ecosistema."
            id="nuestros-socios"
          />
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
