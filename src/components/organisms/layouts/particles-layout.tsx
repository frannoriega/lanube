"use client"

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

export default function ParticlesLayout({ children, className, forceTheme, backgroundClass }: ParticlesLayoutProps) {
    useLayoutEffect(() => {
        initParticlesEngine(async (engine: Engine) => {
            await loadSlim(engine);
        })
    }, []);
    const { resolvedTheme: theme } = useTheme();

    const themeToUse = forceTheme || theme;

    const options = useMemo(() => ({
        style: {
            position: "absolute",
            inset: "0",
        },
        fpsLimit: 120,
        interactivity: {
            events: {
                onHover: {
                    enable: true,
                    mode: "repulse",
                },
            },
            modes: {
                push: {
                    quantity: 4,
                },
                repulse: {
                    distance: 100,
                    duration: 0.4,
                },
            },
        },
        particles: {
            color: {
                value: themeToUse === "dark" ? "#ffffff" : "#000000",
            },
            links: {
                color: themeToUse === "dark" ? "#ffffff" : "#000000",
                distance: 150,
                enable: true,
                opacity: 0.5,
                width: 1,
            },
            move: {
                direction: 'none' as const,
                enable: true,
                outModes: {
                    default: 'bounce' as const,
                },
                random: false,
                speed: 1,
                straight: false,
            },
            number: {
                density: {
                    enable: true,
                },
                value: 120,
            },
            opacity: {
                value: 0.5,
            },
            shape: {
                type: "circle",
            },
            size: {
                value: { min: 1, max: 5 },
            },
        },
        detectRetina: true,
    }), [themeToUse]);

    const cns = cn("relative w-full h-full min-h-screen flex items-center justify-center transition-opacity duration-1000", className)
    const bgCns = cn("-z-50 absolute inset-0 w-full h-full", backgroundClass)

    return (
        <div className={cns}>
            <Particles options={options} className={bgCns} />
            {children}
        </div>
    )
};