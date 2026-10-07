import Container from "@/components/atoms/container";
import { Reveal } from "@/components/molecules/reveal";
import { Button } from "@/components/ui/button";
import { getPublicSiteConfig } from "@/lib/cache/public-reads";
import { ArrowRight, Mail } from "lucide-react";
import Link from "next/link";

/**
 * Cierre de la landing (milestone 18): un panel con el degradé de marca y las dos acciones que
 * importan — reservar un espacio o escribirnos. Antes la página terminaba en la última fila de
 * logos y pasaba directo al footer, sin una invitación final.
 *
 * El correo sale de la configuración del sitio (`getSiteConfig`, editable por el superadmin),
 * el mismo que muestra el footer.
 */
export default async function ClosingCta() {
  const { email } = await getPublicSiteConfig();

  return (
    <section aria-labelledby="sumate" className="w-full">
      <Container className="px-4 py-16 sm:px-8 md:py-24">
        <Reveal>
          <div className="relative overflow-hidden rounded-3xl bg-linear-to-br from-la-nube-selected to-la-nube-ink px-6 py-12 text-white shadow-xl shadow-la-nube-selected/20 sm:px-12 md:py-16">
            {/* Resplandor cian y retícula de puntos: textura de marca sin imágenes. El degradé va del
                azul de marca al azul noche (no al azul claro): el texto blanco necesita ≥ 4.5:1. */}
            <div
              aria-hidden
              className="pointer-events-none absolute -right-24 -top-24 size-96 rounded-full bg-la-nube-secondary/30 blur-3xl"
            />
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 opacity-20 [background-image:radial-gradient(rgba(255,255,255,0.7)_1px,transparent_1px)] [background-size:22px_22px] [mask-image:linear-gradient(to_left,black,transparent_70%)]"
            />
            <div className="relative flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
              <div className="flex max-w-2xl flex-col gap-4">
                <span className="font-mono text-sm font-medium uppercase tracking-[0.2em] text-la-nube-accent">
                  ~/ sumate
                </span>
                <h2
                  id="sumate"
                  className="text-4xl font-bold tracking-tight text-balance md:text-5xl"
                >
                  ¿Querés ser parte de La Nube?
                </h2>
                <p className="text-lg text-pretty text-white/85">
                  Reservá un espacio para trabajar, dar un taller o reunir a tu
                  equipo, o escribinos para sumar tu empresa o institución al
                  ecosistema.
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row md:flex-col lg:flex-row">
                <Button
                  asChild
                  size="lg"
                  className="bg-white text-la-nube-selected hover:bg-white/90"
                >
                  <Link href="/user/dashboard">
                    Reservar un espacio
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="border-white/60 bg-transparent text-white hover:bg-white/10 hover:text-white dark:border-white/60 dark:bg-transparent"
                >
                  <a href={`mailto:${email}`}>
                    <Mail className="h-4 w-4" />
                    Escribinos
                  </a>
                </Button>
              </div>
            </div>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
