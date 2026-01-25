"use client";

import { cn } from "@/lib/utils";
import { Engine } from "@tsparticles/engine";
import { initParticlesEngine, Particles } from "@tsparticles/react";
import { loadSlim } from "@tsparticles/slim";
import { useTheme } from "next-themes";
import { useLayoutEffect, useMemo } from "react";

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
  useLayoutEffect(() => {
    initParticlesEngine(async (engine: Engine) => {
      await loadSlim(engine);
    });
  }, []);
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
          enable: !mobile,          // big win on mobile
          distance: 150,
          opacity: 0.5,
          width: 1,
          color: themeToUse === "dark" ? "#ffffff" : "#000000",
        },
        move: { enable: true, speed: 1, outModes: { default: "bounce" } },
        color: { value: themeToUse === "dark" ? "#ffffff" : "#000000" },
        opacity: { value: 0.5 },
        shape: { type: "circle" },
        size: { value: { min: 1, max: 5 } },
      },
      detectRetina: !mobile,
    };
  }, [themeToUse]);

  const cns = cn(
    "relative w-full flex items-center justify-center transition-opacity duration-1000",
    className,
  );
  const bgCns = cn("-z-50 absolute inset-0 w-full h-full", backgroundClass);

  return (
    <div className={cns}>
      <Particles options={options} className={bgCns} />
      {children}
    </div>
  );
}
