import { PublicForm } from "@/components/organisms/forms/public-form";
import { getParticipantByToken } from "@/lib/db/participants";

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

  if (participant.cancelled) {
    return (
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold">{participant.eventName}</h1>
        <p className="text-muted-foreground">
          Tu inscripción a este evento fue cancelada.
        </p>
      </div>
    );
  }

  return (
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
  );
}
