import Breakout from "@/components/atoms/breakout";
import Container from "@/components/atoms/container";
import { Reveal } from "@/components/molecules/reveal";
import { LANDING_SECTION_BG } from "@/components/templates/landing/shared/section-bg";
import { SectionHeading } from "@/components/templates/landing/shared/section-heading";
import { getSpaceIcon } from "@/lib/constants/spaces";
import { getPublicSpacesByKind } from "@/lib/cache/public-reads";
import type { Space } from "@/lib/db/spaces";
import { ArrowRight, Users } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

/**
 * "Nuestros espacios" en la landing (milestone 18): una grilla de fotos. Las fotos de los
 * espacios son lo que mejor "vende" el lugar, así que ocupan toda la tarjeta, con el nombre,
 * la capacidad y una línea de descripción sobre un degradé oscuro.
 *
 * Reemplaza a las tarjetas horizontales anteriores (`SpaceCard`: foto chica + "[ Nombre ]" +
 * caja de capacidad), que además enlazaban a `/user/<slug>` — una ruta que no existe (la de
 * reservas es `/user/spaces/<slug>`). Ahora cada tarjeta lleva al detalle del espacio en
 * `/spaces#<slug>`, que es donde está el botón de reservar.
 */
export default async function SpacesSection() {
  // Solo espacios: las áreas comunes («amenities») tienen su propia sección (milestone 24).
  const spaces = await getPublicSpacesByKind("SPACE");

  if (spaces.length === 0) return null;

  return (
    <Breakout className={LANDING_SECTION_BG}>
      <section
        className="flex w-full flex-col items-center"
        aria-labelledby="nuestros-espacios"
      >
        <Container className="flex flex-col gap-8 px-8 py-16">
          <SectionHeading
            eyebrow="espacios"
            title="Nuestros"
            accent="espacios"
            lead="Lugares pensados para trabajar, aprender y crear en comunidad. ¡Vení a conocerlos!"
            id="nuestros-espacios"
            action={<AllSpacesLink />}
          />
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {spaces.map((space, i) => (
              <li key={space.id}>
                <Reveal delay={(i % 4) * 0.08} className="h-full">
                  <SpaceTile space={space} />
                </Reveal>
              </li>
            ))}
          </ul>
        </Container>
      </section>
    </Breakout>
  );
}

function AllSpacesLink() {
  return (
    <Link
      href="/spaces"
      className="flex items-center gap-1.5 text-sm font-medium text-la-nube-selected transition-colors hover:text-la-nube-ink dark:text-la-nube-secondary dark:hover:text-white"
    >
      Ver todos los espacios
      <ArrowRight className="h-4 w-4" />
    </Link>
  );
}

/** Tarjeta-foto de un espacio. Sin foto, un panel con el degradé de marca y su ícono. */
export function SpaceTile({
  space,
  cta = "Conocer el espacio",
}: {
  space: Space;
  /** Texto del enlace al pie; las áreas comunes dicen «Conocer más». */
  cta?: string;
}) {
  const Icon = getSpaceIcon(space.iconName);
  return (
    <Link
      href={`/spaces#${space.slug}`}
      className="group relative flex aspect-[4/5] h-full flex-col justify-end overflow-hidden rounded-2xl bg-la-nube-night text-white shadow-sm ring-la-nube-primary outline-none transition-shadow hover:shadow-xl focus-visible:ring-2 sm:aspect-[3/4]"
    >
      {space.imageUrl ? (
        <Image
          src={space.imageUrl}
          alt=""
          fill
          sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
          className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-linear-to-br from-la-nube-primary to-la-nube-secondary">
          <Icon
            className="size-16 text-white/90"
            strokeWidth={1.5}
            aria-hidden
          />
        </div>
      )}
      {/* Degradé para que el texto blanco se lea sobre cualquier foto. */}
      <div
        aria-hidden
        className="absolute inset-0 bg-linear-to-t from-la-nube-night via-la-nube-night/50 to-transparent"
      />
      <div className="relative flex flex-col gap-2 p-5">
        {/* Un área común puede no tener capacidad: entonces no hay chip. */}
        {space.capacity !== null && (
          <span className="inline-flex w-fit items-center gap-1 rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-medium backdrop-blur-sm">
            <Users className="size-3.5" aria-hidden />
            {space.capacity} {space.capacity === 1 ? "persona" : "personas"}
          </span>
        )}
        <h3 className="text-2xl font-bold tracking-tight">{space.name}</h3>
        <p className="line-clamp-2 text-sm text-white/80">
          {space.description}
        </p>
        <span className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-la-nube-secondary">
          {cta}
          <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
        </span>
      </div>
    </Link>
  );
}
