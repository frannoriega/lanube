"use client";

import Breakout from "@/components/atoms/breakout";
import Container from "@/components/atoms/container";
import {
  AnimatedIsologo,
  ISOLOGO_FLY_TEXT_DELAY,
  type IsologoState,
} from "@/components/atoms/logos/lanube/animated-isologo";
import { LANDING_SECTION_BG } from "@/components/templates/landing/shared/section-bg";
import { Button } from "@/components/ui/button";
import { ArrowDown, ArrowRight, ChevronDown } from "lucide-react";
import Link from "next/link";
import { BASE_KEYWORDS } from "@/lib/constants/hero";
import { motion, type Variants } from "framer-motion";
import { useEffect, useRef, useState } from "react";

/**
 * Clave de `sessionStorage`: la intro del logo se ve una vez por sesión del navegador. Al
 * volver al inicio dentro de la misma sesión (o recargar) el hero aparece ya armado.
 */
const INTRO_SEEN_KEY = "lanube-hero-intro-seen";

/**
 * El bloque de texto entra cuando el logo ya se armó (`ISOLOGO_FLY_TEXT_DELAY`), con los hijos
 * escalonados. En `static` aparece en un fundido corto, sin esperar a nada.
 */
const textVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  play: {
    opacity: 1,
    y: 0,
    transition: {
      delay: ISOLOGO_FLY_TEXT_DELAY,
      duration: 0.7,
      ease: [0.22, 1, 0.36, 1],
      when: "beforeChildren",
      staggerChildren: 0.12,
    },
  },
  static: { opacity: 1, y: 0, transition: { duration: 0.25 } },
};

const textItem: Variants = {
  hidden: { opacity: 0, y: 12 },
  play: { opacity: 1, y: 0, transition: { duration: 0.55 } },
  static: { opacity: 1, y: 0, transition: { duration: 0 } },
};

/**
 * Decide, ya en el cliente, si corre la intro: no con `prefers-reduced-motion` ni si ya se vio
 * en esta sesión. Arranca en `hidden` (también en el HTML del servidor) para que el logo no
 * aparezca armado y después "salte" afuera de la pantalla al empezar la animación.
 */
function useIntroState(): IsologoState {
  const [state, setState] = useState<IsologoState>("hidden");
  // La decisión se toma una sola vez por montaje. Sin esta ref, en desarrollo el StrictMode
  // corre el efecto dos veces: la primera marca la sesión como "vista" y la segunda, al leer
  // esa marca, saltaba directo al estado final — la intro no se veía nunca en `npm run dev`.
  const decided = useRef<IsologoState | null>(null);
  useEffect(() => {
    if (decided.current) {
      setState(decided.current);
      return;
    }
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    let seen = false;
    try {
      seen = window.sessionStorage.getItem(INTRO_SEEN_KEY) === "1";
      window.sessionStorage.setItem(INTRO_SEEN_KEY, "1");
    } catch {
      // Storage bloqueado (modo privado estricto): se trata como primera visita.
    }
    decided.current = reduced || seen ? "static" : "play";
    setState(decided.current);
  }, []);
  return state;
}

export default function HeroSection({
  eyebrowOverride,
  keywords = BASE_KEYWORDS,
}: {
  /** Replaces the "Una iniciativa de..." line while a landing theme is active. */
  eyebrowOverride?: string | null;
  /**
   * The full rotating keyword list — already resolved (defaults, or a theme's
   * APPEND/REPLACE combination via `resolveHeroKeywords`). Defaults to
   * `BASE_KEYWORDS` when no theme is active. Never empty in practice (the
   * resolver falls back to defaults rather than an empty list).
   */
  keywords?: string[];
}) {
  const [keywordIndex, setKeywordIndex] = useState(0);
  const [displayedText, setDisplayedText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const currentKeyword = keywords[keywordIndex % keywords.length];

    const timeout = setTimeout(
      () => {
        if (!isDeleting) {
          if (displayedText.length < currentKeyword.length) {
            setDisplayedText(currentKeyword.slice(0, displayedText.length + 1));
          } else {
            setTimeout(() => setIsDeleting(true), 3000);
          }
        } else {
          if (displayedText.length > 0) {
            setDisplayedText(displayedText.slice(0, -1));
          } else {
            setIsDeleting(false);
            setKeywordIndex((prevIndex) => (prevIndex + 1) % keywords.length);
          }
        }
      },
      isDeleting ? 50 : 100,
    );

    return () => clearTimeout(timeout);
  }, [displayedText, isDeleting, keywordIndex, keywords]);

  const intro = useIntroState();

  // Hero (milestone 17): dos columnas desde `lg` — texto alineado a la izquierda y el
  // isologo animado a la derecha—; en teléfono, el logo arriba y el texto centrado debajo.
  // `overflow-x-clip` evita que los nodos que llegan "desde fuera de la pantalla" generen
  // scroll horizontal mientras vuelan (clip, no hidden: no crea un contenedor de scroll).
  return (
    <Breakout className={`${LANDING_SECTION_BG} overflow-x-clip`}>
      {/* Sin JavaScript no hay intro: el texto y el logo se muestran directamente. */}
      <noscript>
        <style>{`.hero-intro{opacity:1!important;transform:none!important}`}</style>
      </noscript>
      <Container>
        <section
          className="flex min-h-[calc(100svh-var(--spacing)*24)] w-full flex-col justify-between px-4 py-8 lg:px-8"
          aria-label="Sección inicial"
        >
          <div className="grid flex-1 items-center gap-8 lg:grid-cols-[1.15fr_1fr] lg:gap-12">
            <div className="flex justify-center lg:order-2">
              <AnimatedIsologo
                mode="fly"
                state={intro}
                className="w-40 sm:w-52 lg:w-full lg:max-w-[26rem]"
              />
            </div>

            <motion.div
              className="hero-intro flex flex-col items-center gap-8 text-center lg:items-start lg:text-left"
              initial="hidden"
              animate={intro}
              variants={textVariants}
            >
              <motion.div
                variants={textItem}
                className="hero-intro flex flex-col items-center gap-3 lg:items-start"
              >
                <p className="text-center text-xs font-semibold uppercase tracking-widest text-balance text-la-nube-selected sm:text-sm lg:text-left dark:text-la-nube-secondary">
                  {eyebrowOverride ||
                    "Una iniciativa de Concepción del Uruguay"}
                </p>
                <div className="text-3xl font-bold md:text-5xl lg:text-6xl">
                  <h1 className="text-5xl tracking-tight text-la-nube-ink md:text-7xl lg:text-8xl dark:text-white">
                    La Nube
                  </h1>
                  <h2 className="text-balance text-la-nube-ink/85 dark:text-white/90">
                    un espacio de{" "}
                    {/* La palabra que se escribe sola va en una celda tan ancha como la palabra
                        más larga (todas apiladas, invisibles, en la misma celda de la grilla).
                        Así el renglón corta siempre en el mismo lugar: antes, cuando una palabra
                        larga no entraba, saltaba de renglón y empujaba todo el bloque. */}
                    <span className="inline-grid justify-items-center align-bottom lg:justify-items-start">
                      {keywords.map((k) => (
                        <span
                          key={k}
                          aria-hidden
                          className="invisible col-start-1 row-start-1"
                        >
                          {k}|
                        </span>
                      ))}
                      <span className="col-start-1 row-start-1 bg-linear-to-r from-la-nube-primary to-la-nube-secondary bg-clip-text text-transparent">
                        {displayedText}
                        <span className="animate-blink">|</span>
                      </span>
                    </span>
                  </h2>
                </div>
              </motion.div>
              <motion.p
                variants={textItem}
                className="hero-intro max-w-prose text-base text-pretty lg:text-xl"
              >
                Impulsamos la Economía del Conocimiento en Concepción del
                Uruguay, conectando empresas, universidades, emprendedores y
                sector público para transformar el futuro.
              </motion.p>
              <motion.div
                variants={textItem}
                className="hero-intro flex flex-col items-center gap-3 sm:flex-row"
              >
                <Button asChild size="lg" variant="brand">
                  <Link href="/user/dashboard">
                    Reservar un espacio
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="ghost">
                  <Link href="#nuestros-espacios">
                    Conocer los espacios
                    <ChevronDown className="h-4 w-4" />
                  </Link>
                </Button>
              </motion.div>
            </motion.div>
          </div>
          <div className="flex w-full flex-col items-center pb-2">
            <div className="animate-float rounded-full bg-la-nube-accent/50 p-3 dark:bg-la-nube-selected/20">
              <ArrowDown className="h-4 w-4 text-la-nube-primary dark:text-la-nube-secondary" />
            </div>
          </div>
        </section>
      </Container>
    </Breakout>
  );
}
