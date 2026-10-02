import Container from "@/components/atoms/container";
import { SectionHeading } from "@/components/templates/landing/shared/section-heading";
import { CalendarClock } from "lucide-react";
import { PolicyContent } from "./policy-content";
import { TableOfContents } from "./table-of-contents";

export const metadata = {
  title: "Política de privacidad | La Nube",
  description:
    "Cómo La Nube y la Municipalidad de Concepción del Uruguay tratan los datos personales de quienes usan la plataforma.",
};

/**
 * Fecha de la última modificación del **texto** de la política (último commit que tocó
 * `src/assets/policies/privacy.mdx`: 16/11/2025). La propia política promete publicar los
 * cambios "con indicación de su fecha de actualización" (sección 12), así que **hay que
 * actualizar esta constante cada vez que cambie el texto**. Milestone 17.
 */
const LAST_UPDATED = "16 de noviembre de 2025";

/**
 * Política de privacidad (rediseño del milestone 17): una columna de lectura angosta (~70
 * caracteres por renglón, antes ocupaba todo el ancho), la fecha de actualización arriba y
 * un índice fijo a la izquierda en escritorio que marca la sección que se está leyendo.
 *
 * El contenido sigue siendo el MDX de siempre, renderizado por `PolicyContent` (que le da
 * `id` a cada sección para el índice). La página en sí es de servidor (exporta `metadata`).
 */
export default function PrivacyPolicyPage() {
  return (
    <Container className="h-fit">
      <div className="mx-4 my-12 flex flex-col gap-10 sm:mx-8">
        <div className="flex flex-col gap-4">
          <SectionHeading
            as="h1"
            eyebrow="políticas"
            title="Política de"
            accent="privacidad"
            lead="Qué datos personales recolecta La Nube, para qué los usa y cuáles son tus derechos."
          />
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <CalendarClock className="size-4" aria-hidden />
            Última actualización: {LAST_UPDATED}
          </p>
        </div>

        <div className="grid gap-10 lg:grid-cols-[16rem_minmax(0,1fr)]">
          <aside className="hidden lg:block">
            <div className="sticky top-28">
              <TableOfContents />
            </div>
          </aside>
          <article
            id="politica"
            className="max-w-[70ch] rounded-2xl border bg-card/70 p-6 text-base leading-relaxed text-foreground backdrop-blur-sm sm:p-10 [&_h2]:mt-10 [&_h2]:mb-3 [&_h2]:scroll-mt-28 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:tracking-tight [&_h2]:text-la-nube-ink [&_h2:first-of-type]:mt-0 dark:[&_h2]:text-white [&_hr]:hidden [&_li]:my-1 [&_p]:my-3 [&_strong]:font-semibold [&_strong]:text-foreground [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6"
          >
            <PolicyContent />
          </article>
        </div>
      </div>
    </Container>
  );
}
