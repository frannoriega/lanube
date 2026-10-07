import Breakout from "@/components/atoms/breakout";
import Container from "@/components/atoms/container";
import { Reveal } from "@/components/molecules/reveal";
import { LANDING_SECTION_BG } from "@/components/templates/landing/shared/section-bg";
import { SectionHeading } from "@/components/templates/landing/shared/section-heading";
import { SpaceTile } from "@/components/templates/landing/spaces";
import { getPublicSpacesByKind } from "@/lib/cache/public-reads";
import { ArrowRight } from "lucide-react";
import Link from "next/link";

/**
 * "Amenities" en la landing (milestone 24): las áreas comunes (cocina, jardín, living…) que
 * no se reservan. Va justo después de «Nuestros espacios» y reusa su tarjeta-foto
 * (`SpaceTile`), porque la foto es lo que mejor las muestra. Cada tarjeta enlaza a
 * `/spaces#<slug>`, donde están su descripción y sus preguntas frecuentes.
 *
 * Devuelve `null` si no hay ninguna: la sección es opcional y, como cada sección de la landing
 * tiene su propio `Breakout`, no deja una franja vacía ni rompe la alternancia de fondos
 * (ver `LANDING_SECTION_BG`).
 */
export default async function AmenitiesSection() {
  const amenities = await getPublicSpacesByKind("AMENITY");

  if (amenities.length === 0) return null;

  return (
    <Breakout className={LANDING_SECTION_BG}>
      <section
        className="flex w-full flex-col items-center"
        aria-labelledby="nuestras-amenities"
      >
        <Container className="flex flex-col gap-8 px-8 py-16">
          <SectionHeading
            eyebrow="amenities"
            title="Y además, nuestras"
            accent="amenities"
            lead="Las áreas comunes que hacen más cómodo el día a día en La Nube."
            id="nuestras-amenities"
            action={
              <Link
                href="/spaces#amenities"
                className="flex items-center gap-1.5 text-sm font-medium text-la-nube-selected transition-colors hover:text-la-nube-ink dark:text-la-nube-secondary dark:hover:text-white"
              >
                Ver todas las amenities
                <ArrowRight className="h-4 w-4" />
              </Link>
            }
          />
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {amenities.map((amenity, i) => (
              <li key={amenity.id}>
                <Reveal delay={(i % 4) * 0.08} className="h-full">
                  <SpaceTile space={amenity} cta="Conocer más" />
                </Reveal>
              </li>
            ))}
          </ul>
        </Container>
      </section>
    </Breakout>
  );
}
