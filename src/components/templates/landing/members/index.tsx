"use client";

import Breakout from "@/components/atoms/breakout";
import Container from "@/components/atoms/container";
import { LANDING_SECTION_BG } from "@/components/templates/landing/shared/section-bg";
import { LogoCard } from "@/components/molecules/logo-card";
import { Marquee } from "@/components/molecules/marquee";
import { useViewportWidth } from "@/hooks/use-viewport-width";
import { members } from "@/lib/constants/members";

const MOBILE_BREAKPOINT = 768;

export default function MembersSection() {
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
            <span className="font-mono text-sm font-medium uppercase tracking-[0.2em] text-brand-selected dark:text-brand-secondary">
              ~/ miembros
              <span className="animate-blink">▌</span>
            </span>
            <h2 id="nuestros-miembros" className="text-5xl font-bold">
              Nuestros{" "}
              <span className="bg-linear-to-r from-brand-primary to-brand-secondary bg-clip-text text-transparent">
                miembros
              </span>
            </h2>
            <p className="max-w-prose text-lg text-muted-foreground">
              Conoce a los profesionales que hacen posible la innovación en
              nuestro polo tecnológico
            </p>
          </div>
          <div className="w-full flex flex-row">
            <Marquee
              gradientWidth={gradientWidth}
              speed={50}
              pauseOnHover
              className="py-4"
            >
              {members.map((member) => (
                <LogoCard
                  key={member.id}
                  name={member.name}
                  img={member.img}
                  url={member.url}
                />
              ))}
            </Marquee>
          </div>
        </Container>
      </section>
    </Breakout>
  );
}
