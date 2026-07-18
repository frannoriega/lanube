import Container from "@/components/atoms/container";
import { Markdown } from "@/components/molecules/markdown";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { getSpaceIcon } from "@/lib/constants/spaces";
import { getPublicSpaces, getSpaceFaqs, type Space } from "@/lib/db/spaces";
import { cn } from "@/lib/utils";
import { Users } from "lucide-react";
import Image from "next/image";

export const metadata = {
  title: "Espacios | La Nube",
  description:
    "Conocé los espacios de La Nube: coworking, sala de reuniones, sala de conferencias y laboratorio.",
};

export default async function SpacesPage() {
  const spaces = await getPublicSpaces();

  return (
    <Container className="h-fit">
      <div className="mx-4 my-12 flex h-fit flex-col gap-10 sm:mx-8">
        <header className="flex flex-col gap-3">
          <span className="font-mono text-xs uppercase tracking-[0.2em] text-brand-selected dark:text-brand-secondary">
            ~/ espacios
          </span>
          <h1 className="text-4xl font-bold text-balance sm:text-5xl">
            Nuestros espacios
          </h1>
          <p className="max-w-prose text-pretty text-lg text-muted-foreground">
            Lugares pensados para trabajar, aprender y crear en comunidad. Cada
            espacio tiene su equipamiento y sus reglas de uso.
          </p>
        </header>

        {spaces.length === 0 ? (
          <Card className="glass-card dark:glass-card-dark">
            <CardContent className="py-16 text-center text-muted-foreground">
              Todavía no hay espacios para mostrar.
            </CardContent>
          </Card>
        ) : (
          <div className="flex flex-col gap-8">
            {spaces.map((space, index) => (
              <SpaceSection
                key={space.id}
                space={space}
                pos={index % 2 === 0 ? "left" : "right"}
              />
            ))}
          </div>
        )}
      </div>
    </Container>
  );
}

function SpaceSection({ space, pos }: { space: Space; pos: "left" | "right" }) {
  const faqs = getSpaceFaqs(space);
  const body = space.longDescription?.trim();

  return (
    <Card className="glass-card h-fit w-full dark:glass-card-dark">
      <CardContent className="flex h-fit w-full flex-col gap-6 pt-6">
        {/* flow-root contains the floated image so a tall image never bleeds past its
            text into the FAQ below. */}
        <div className="w-full space-y-4 [display:flow-root]">
          <SpaceImage space={space} pos={pos} />
          {body ? (
            <Markdown className="text-base [&>*:first-child]:mt-0">
              {body}
            </Markdown>
          ) : (
            <p className="whitespace-pre-line text-base text-muted-foreground">
              {space.description}
            </p>
          )}
        </div>

        {faqs.length > 0 && (
          <Accordion
            type="multiple"
            className="w-full rounded-xl bg-slate-700/10 px-4 dark:bg-white/10"
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
      </CardContent>
    </Card>
  );
}

function SpaceImage({ space, pos }: { space: Space; pos: "left" | "right" }) {
  const floatCns = cn(
    "relative mb-2 flex h-fit w-full flex-col overflow-hidden rounded-xl sm:w-3/5",
    pos === "left" ? "sm:float-left sm:mr-6" : "sm:float-right sm:ml-6",
  );

  const TitleOverlay = (
    <>
      {/* Mobile: solid title bar under/over the visual */}
      <div className="w-full bg-brand-primary py-2 text-center font-bold text-white sm:hidden">
        <h2>{space.name}</h2>
      </div>
      {/* Desktop: floating glass label */}
      <div
        className={cn(
          "absolute top-4 hidden bg-brand-primary/60 px-8 py-2 backdrop-blur-sm sm:block lg:px-16 lg:py-6",
          pos === "left" ? "left-0 rounded-r-full" : "right-0 rounded-l-full",
        )}
      >
        <h2 className="text-2xl font-bold text-white">{space.name}</h2>
      </div>
    </>
  );

  if (space.imageUrl) {
    return (
      <div className={floatCns}>
        {TitleOverlay}
        <Image
          src={space.imageUrl}
          alt={space.name}
          width={1024}
          height={1024}
          className="h-auto w-full self-start object-cover"
        />
        <CapacityBadge capacity={space.capacity} />
      </div>
    );
  }

  // No image: branded panel with the space's icon.
  const Icon = getSpaceIcon(space.iconName);
  return (
    <div className={floatCns}>
      {TitleOverlay}
      <div className="flex aspect-[4/3] w-full items-center justify-center bg-gradient-to-br from-brand-primary/15 to-brand-secondary/15">
        <Icon
          className="size-20 text-brand-selected dark:text-brand-secondary"
          strokeWidth={1.5}
          aria-hidden
        />
      </div>
      <CapacityBadge capacity={space.capacity} />
    </div>
  );
}

function CapacityBadge({ capacity }: { capacity: number }) {
  return (
    <Badge
      variant="secondary"
      className="absolute bottom-3 right-3 gap-1 backdrop-blur-sm"
    >
      <Users className="size-3.5" aria-hidden />
      {capacity} {capacity === 1 ? "persona" : "personas"}
    </Badge>
  );
}
