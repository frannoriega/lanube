import { PublicForm } from "@/components/organisms/forms/public-form";
import { Button } from "@/components/ui/button";
import { getParticipantByToken } from "@/lib/db/participants";
import { ParticipantStatus } from "@/types/prisma";
import { Link2Off } from "lucide-react";
import Link from "next/link";

/** Pantalla para un enlace de edición que ya no sirve: ícono, título y cómo seguir. */
function LinkProblem({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-4 py-6 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Link2Off className="h-7 w-7" aria-hidden />
      </span>
      <h1 className="text-2xl font-bold">{title}</h1>
      <div className="flex max-w-prose flex-col items-center gap-4 text-muted-foreground">
        {children}
      </div>
    </div>
  );
}

export default async function ResponsePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const participant = await getParticipantByToken(token);

  // El enlace no existe (mal copiado) o venció porque el evento terminó (milestone 25, S5): una
  // pantalla que explica qué pasó y cómo seguir, en vez de un «no encontrado» seco.
  if (participant.state === "expired") {
    return (
      <LinkProblem title={participant.eventName}>
        <p>
          Este evento ya terminó, así que el enlace para gestionar la
          inscripción dejó de funcionar.
        </p>
      </LinkProblem>
    );
  }
  if (participant.state === "invalid") {
    return (
      <LinkProblem title="Este enlace no funciona">
        <p>
          Puede que se haya copiado incompleto, o que la inscripción ya no
          exista. Si te inscribiste a un evento que todavía no terminó, te
          mandamos un enlace nuevo a tu correo.
        </p>
        <Button asChild variant="brand">
          <Link href="/forms/response/request-link">Pedir un enlace nuevo</Link>
        </Button>
      </LinkProblem>
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
