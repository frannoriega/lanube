import { EventHero } from "@/components/organisms/forms/event-hero";
import { PublicForm } from "@/components/organisms/forms/public-form";
import { getPublicForm } from "@/lib/db/participants";

const CLOSED_MESSAGES: Record<string, string> = {
  closed: "Las inscripciones no están abiertas en este momento.",
  full: "El evento alcanzó el cupo máximo de participantes.",
  unpublished: "Las inscripciones todavía no están disponibles.",
};

export default async function PublicFormPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const form = await getPublicForm(slug);

  if (!form) {
    return (
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-bold">Formulario no encontrado</h1>
        <p className="text-muted-foreground">El enlace no es válido.</p>
      </div>
    );
  }

  if (form.status !== "open") {
    return (
      <div className="space-y-6">
        <EventHero
          name={form.eventName}
          description={form.eventDescription}
          imageUrl={form.eventImageUrl}
          align="center"
        />
        <p className="text-center text-muted-foreground">
          {CLOSED_MESSAGES[form.status] ?? "No disponible."}
        </p>
      </div>
    );
  }

  return (
    <PublicForm
      mode="submit"
      slug={slug}
      eventName={form.eventName}
      eventDescription={form.eventDescription}
      eventImageUrl={form.eventImageUrl}
      schema={form.schema}
      notice={
        <div className="space-y-2">
          {form.spotsLeft !== null && (
            <p className="text-sm font-medium text-muted-foreground">
              Cupos disponibles: {form.spotsLeft}
            </p>
          )}
          {form.requiresApproval && (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">
              Este evento tiene cupos limitados y las inscripciones están
              sujetas a aprobación.{" "}
              <strong>Inscribirte no garantiza tu lugar</strong>: te avisaremos
              por email cuando tu inscripción sea revisada.
            </div>
          )}
        </div>
      }
    />
  );
}
