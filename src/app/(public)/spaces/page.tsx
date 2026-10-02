import Container from "@/components/atoms/container";
import { Markdown } from "@/components/molecules/markdown";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ParallaxImage } from "@/components/molecules/parallax-image";
import { Reveal } from "@/components/molecules/reveal";
import { SectionHeading } from "@/components/templates/landing/shared/section-heading";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getMetadataIcon, getSpaceIcon } from "@/lib/constants/spaces";
import { getPublicSpaces, getSpaceFaqs, type Space } from "@/lib/db/spaces";
import type { SpaceMetadataItem } from "@/lib/types/spaces";
import { cn } from "@/lib/utils";
import { ArrowRight, type LucideIcon, Users } from "lucide-react";
import Link from "next/link";

export const metadata = {
  title: "Espacios | La Nube",
  description:
    "Conocé los espacios de La Nube: coworking, sala de reuniones, sala de conferencias y laboratorio.",
};

export default async function SpacesPage() {
  const spaces = await getPublicSpaces();

  return (
    <Container className="h-fit">
      <div className="mx-4 my-12 flex h-fit flex-col gap-12 sm:mx-8 md:gap-20">
        <SectionHeading
          as="h1"
          eyebrow="espacios"
          title="Nuestros"
          accent="espacios"
          lead="Lugares pensados para trabajar, aprender y crear en comunidad. Cada espacio tiene su equipamiento y sus reglas de uso."
        />

        {spaces.length === 0 ? (
          <Card className="glass-card dark:glass-card-dark">
            <CardContent className="py-16 text-center text-muted-foreground">
              Todavía no hay espacios para mostrar.
            </CardContent>
          </Card>
        ) : (
          <div className="flex flex-col gap-16 md:gap-24">
            {spaces.map((space, index) => (
              <SpaceSection
                key={space.id}
                space={space}
                flip={index % 2 === 1}
              />
            ))}
          </div>
        )}
      </div>
    </Container>
  );
}

/**
 * Un espacio (rediseño del milestone 17): foto grande con parallax sutil de un lado y, del
 * otro, el nombre, la capacidad y el equipamiento como chips, la descripción y el botón de
 * reservar. Los lados se alternan en escritorio para darle ritmo a la página.
 *
 * Antes el nombre iba en una etiqueta flotante *encima* de la foto (tapaba lo que mostraba la
 * imagen: en la sala de reuniones cortaba el logo de la pantalla) y no había forma de reservar
 * desde acá. Las preguntas frecuentes quedan debajo, como renglones livianos en vez de un
 * bloque gris.
 *
 * El `id` es el slug del espacio: las tarjetas de la landing enlazan a `/spaces#<slug>`.
 */
function SpaceSection({ space, flip }: { space: Space; flip: boolean }) {
  const faqs = getSpaceFaqs(space);
  const body = space.longDescription?.trim();
  const equipment = (space.metadata ?? []) as SpaceMetadataItem[];

  return (
    <section
      id={space.slug}
      aria-labelledby={`${space.slug}-titulo`}
      className="scroll-mt-28 flex flex-col gap-8"
    >
      <Reveal>
        <div className="grid items-start gap-8 lg:grid-cols-2 lg:gap-12">
          <div className={cn(flip && "lg:order-2")}>
            {space.imageUrl ? (
              <ParallaxImage
                src={space.imageUrl}
                alt={space.name}
                sizes="(min-width: 1024px) 50vw, 100vw"
                className="aspect-[4/3] w-full rounded-2xl shadow-lg"
              />
            ) : (
              <SpaceIconPanel space={space} />
            )}
          </div>

          <div className="flex flex-col gap-5">
            <h2
              id={`${space.slug}-titulo`}
              className="text-3xl font-bold tracking-tight text-la-nube-ink md:text-4xl dark:text-white"
            >
              {space.name}
            </h2>
            <ul
              className="flex flex-wrap gap-2"
              aria-label="Capacidad y equipamiento"
            >
              <Chip icon={Users}>
                {space.capacity} {space.capacity === 1 ? "persona" : "personas"}
              </Chip>
              {equipment.map((item, i) => (
                <Chip key={i} icon={getMetadataIcon(item.icon)}>
                  {item.type === "stat"
                    ? item.value
                    : `${item.numerator} / ${item.denominator}`}
                  {item.label ? ` ${item.label}` : ""}
                </Chip>
              ))}
            </ul>
            {body ? (
              <Markdown className="text-base [&>*:first-child]:mt-0">
                {body}
              </Markdown>
            ) : (
              <p className="whitespace-pre-line text-base text-muted-foreground">
                {space.description}
              </p>
            )}
            {space.isReservable && (
              <Button asChild variant="brand" size="lg" className="self-start">
                <Link href={`/user/spaces/${space.slug}`}>
                  Reservar este espacio
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            )}
          </div>
        </div>
      </Reveal>

      {faqs.length > 0 && (
        <Accordion
          type="multiple"
          className="w-full rounded-2xl border bg-card/60 px-5 backdrop-blur-sm"
        >
          {faqs.map((faq, i) => (
            <AccordionItem
              key={i}
              value={`faq-${i}`}
              className="last:border-b-0"
            >
              <AccordionTrigger className="text-left text-base font-semibold">
                {faq.question}
              </AccordionTrigger>
              <AccordionContent>
                <Markdown className="text-base">{faq.answer}</Markdown>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}
    </section>
  );
}

function Chip({
  icon: Icon,
  children,
}: {
  icon: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <li className="inline-flex items-center gap-1.5 rounded-full border border-la-nube-primary/25 bg-la-nube-accent/40 px-3 py-1 text-sm font-medium text-la-nube-ink dark:border-la-nube-secondary/25 dark:bg-la-nube-selected/20 dark:text-white">
      <Icon
        className="size-4 text-la-nube-selected dark:text-la-nube-secondary"
        aria-hidden
      />
      {children}
    </li>
  );
}

/** Sin foto: panel con el degradé de marca y el ícono del espacio, mismo marco que la foto. */
function SpaceIconPanel({ space }: { space: Space }) {
  const Icon = getSpaceIcon(space.iconName);
  return (
    <div className="flex aspect-[4/3] w-full items-center justify-center rounded-2xl bg-linear-to-br from-la-nube-primary/15 to-la-nube-secondary/15">
      <Icon
        className="size-20 text-la-nube-selected dark:text-la-nube-secondary"
        strokeWidth={1.5}
        aria-hidden
      />
    </div>
  );
}
