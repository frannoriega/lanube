import { PublicForm } from "@/components/organisms/forms/public-form";
import { getParticipantByToken } from "@/modules/events/db/participants";
import { ParticipantStatus } from "@/types/prisma";

export default async function ResponsePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const participant = await getParticipantByToken(token);

  if (!participant) {
    return (
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold">Inscripción no encontrada</h1>
        <p className="text-muted-foreground">El enlace no es válido.</p>
      </div>
    );
  }

  // Terminal states can't be edited — show a status message instead of the form.
  if (participant.status === ParticipantStatus.CANCELLED) {
    return (
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold">{participant.eventName}</h1>
        <p className="text-muted-foreground">
          Tu inscripción a este evento fue cancelada.
        </p>
      </div>
    );
  }

  if (participant.status === ParticipantStatus.REJECTED) {
    return (
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold">{participant.eventName}</h1>
        <p className="text-muted-foreground">
          Lamentablemente no pudimos confirmar tu lugar en este evento.
        </p>
        {participant.decisionReason && (
          <p className="text-muted-foreground">
            <strong>Motivo:</strong> {participant.decisionReason}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {participant.status === ParticipantStatus.PENDING && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">
          Tu inscripción está <strong>pendiente de aprobación</strong>.
          Inscribirte no garantiza tu lugar; te avisaremos por email cuando sea
          revisada.
        </div>
      )}
      <PublicForm
        mode="edit"
        token={token}
        eventName={participant.eventName}
        eventDescription={participant.eventDescription}
        eventImageUrl={participant.eventImageUrl}
        schema={participant.schema}
        initialEmail={participant.displayEmail ?? ""}
        initialAnswers={participant.answers}
      />
    </div>
  );
}
