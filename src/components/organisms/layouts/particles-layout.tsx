"use client";

import { cn } from "@/lib/utils";
import { OutMode } from "@tsparticles/engine";
import { Particles, ParticlesProvider } from "@tsparticles/react";
import { loadSlim } from "@tsparticles/slim";
import { useTheme } from "next-themes";
import { useMemo } from "react";

interface ParticlesLayoutProps extends React.ComponentPropsWithoutRef<"div"> {
  forceTheme?: "light" | "dark";
  backgroundClass?: string;
}

export default function ParticlesLayout({
  children,
  className,
  forceTheme,
  backgroundClass,
}: ParticlesLayoutProps) {
  const { resolvedTheme: theme } = useTheme();

  const themeToUse = forceTheme || theme;

  const isCoarsePointer =
    typeof window !== "undefined" &&
    window.matchMedia("(pointer: coarse)").matches;

  const prefersReducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const options = useMemo(() => {
    const mobile = isCoarsePointer || prefersReducedMotion;

    return {
      style: { position: "absolute", inset: "0" },
      fpsLimit: mobile ? 30 : 60,
      interactivity: {
        events: {
          onHover: { enable: !mobile, mode: "repulse" },
        },
        modes: { repulse: { distance: 100, duration: 0.4 } },
      },
      particles: {
        number: { density: { enable: true }, value: mobile ? 50 : 120 },
        links: {
          enable: !mobile,
          distance: 150,
          opacity: 0.5,
          width: 1,
          color: themeToUse === "dark" ? "#ffffff" : "#777777",
        },
        move: { enable: true, speed: 1, outModes: { default: OutMode.bounce } },
        color: { value: themeToUse === "dark" ? "#ffffff" : "#777777" },
        opacity: { value: 0.5 },
        shape: { type: "circle" },
        size: { value: { min: 1, max: 5 } },
      },
      detectRetina: !mobile,
    };
  }, [themeToUse, isCoarsePointer, prefersReducedMotion]);

  // ⚠️ Solo el canvas va dentro de `ParticlesProvider`, nunca `children`. En
  // `@tsparticles/react` 4.x el provider renderiza `loaded ? children : null`, y `loaded`
  // recién pasa a true en un efecto del navegador. Con la página adentro (así estuvo desde
  // el 2026-05-23, `ff762cf`), el servidor nunca renderizaba el contenido: todo el sitio
  // público y el ingreso se servían como un HTML vacío que se llenaba recién con JS (malo
  // para buscadores y primera pintura), y un `notFound()` de una página no llegaba a correr
  // en el servidor, así que las páginas inexistentes respondían 200 en vez de 404.
  return (
    <div
      className={cn(
        "relative min-h-[100svh] w-full bg-background transition-opacity duration-1000",
        className,
      )}
    >
      {!prefersReducedMotion && (
        <ParticlesProvider init={loadSlim}>
          <Particles
            options={options}
            className={cn(
              "absolute inset-0 z-0 h-full w-full pointer-events-none",
              backgroundClass,
            )}
          />
        </ParticlesProvider>
      )}
      <div className="relative z-10 w-full min-h-[100svh]">{children}</div>
    </div>
  );
}
