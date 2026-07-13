import Breakout from "@/components/atoms/breakout";
import Container from "@/components/atoms/container";
import { Button } from "@/components/ui/button";
import { ArrowDown, ArrowRight, ChevronDown } from "lucide-react";
import Link from "next/link";
import Typewriter from "./typewriter";

const keywords = [
  "innovación",
  "talento",
  "conocimiento",
  "aprendizaje",
  "colaboración",
  "creación",
];

export default function HeroSection() {
  return (
    <Breakout>
      <Container>
        <section
          className="px-4 lg:px-0 w-full h-[calc(100vh-var(--spacing)*24)] flex flex-col items-center justify-between py-8"
          aria-label="Sección inicial"
        >
          <div className="flex flex-col items-center justify-center gap-8 flex-1">
            <div className="flex flex-col items-center justify-center gap-8">
              <div className="lg:text-6xl md:text-5xl text-3xl font-bold text-center">
                <h1 className="lg:text-7xl md:text-6xl text-4xl">La Nube</h1>
                <h2 className="text-balance">
                  un espacio de <span className="sr-only">{keywords[0]}</span>
                  <Typewriter keywords={keywords} />
                </h2>
              </div>
              <p className="text-center max-w-prose lg:text-xl text-base text-pretty">
                Impulsamos la Economía del Conocimiento en Concepción del
                Uruguay, conectando empresas, universidades, emprendedores y
                sector público para transformar el futuro.
              </p>
              <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
                <Button asChild size="lg">
                  <Link href="/user/dashboard">
                    Reservar un espacio
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Link
                  href="#nuestros-espacios"
                  className="flex min-h-11 items-center gap-1.5 px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  Conocer más
                  <ChevronDown className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
          <div className="flex flex-col items-center w-full pb-2">
            <div className="animate-float rounded-full p-3 bg-la-nube-accent/50 dark:bg-la-nube-selected/20">
              <ArrowDown className="h-4 w-4 text-la-nube-primary dark:text-la-nube-secondary" />
            </div>
          </div>
        </section>
      </Container>
    </Breakout>
  );
}
