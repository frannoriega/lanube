import Breakout from "@/components/atoms/breakout";
import Container from "@/components/atoms/container";
import { LANDING_SECTION_BG } from "@/components/templates/landing/shared/section-bg";
import { getPublicSpaces } from "@/lib/db/spaces";
import { SpacesList } from "./spaces-list";

export default async function SpacesSection() {
  const spaces = await getPublicSpaces();

  if (spaces.length === 0) return null;

  return (
    <Breakout className={LANDING_SECTION_BG}>
      <section
        className="w-full flex flex-col items-center border-t border-la-nube-primary/15"
        aria-labelledby="nuestros-espacios"
      >
        <Container className="flex flex-col gap-8 px-8 py-16">
          {/* Section header */}
          <div className="flex flex-col gap-3">
            <span className="font-mono text-sm font-medium uppercase tracking-[0.2em] text-la-nube-selected dark:text-la-nube-secondary">
              ~/ espacios
              <span className="animate-blink">▌</span>
            </span>
            <h2
              id="nuestros-espacios"
              className="text-5xl font-bold"
              style={{ textWrap: "balance" } as React.CSSProperties}
            >
              Nuestros{" "}
              <span className="bg-linear-to-r from-la-nube-primary to-la-nube-secondary bg-clip-text text-transparent">
                espacios
              </span>
            </h2>
            <p className="max-w-prose text-lg text-muted-foreground">
              Los espacios de trabajo que ofrecemos. ¡Vení a conocerlos!
            </p>
          </div>

          <SpacesList spaces={spaces} />
        </Container>
      </section>
    </Breakout>
  );
}
