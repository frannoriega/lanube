import { Button } from "@/components/ui/button";
import { getPublicForm } from "@/lib/db/participants";
import { CheckCircle2, Clock } from "lucide-react";
import Link from "next/link";

export default async function SubmittedPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const form = await getPublicForm(slug);
  const requiresApproval = form?.requiresApproval ?? false;

  return (
    <div className="flex flex-col items-center gap-4 py-6 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-la-nube-accent text-la-nube-selected dark:bg-la-nube-selected/30 dark:text-la-nube-secondary">
        {requiresApproval ? (
          <Clock className="h-7 w-7" />
        ) : (
          <CheckCircle2 className="h-7 w-7" />
        )}
      </span>
      <h1 className="text-2xl font-bold">
        {requiresApproval
          ? "¡Recibimos tu inscripción!"
          : "¡Listo, quedaste inscripto!"}
      </h1>
      <p className="max-w-prose text-muted-foreground">
        {requiresApproval ? (
          <>
            Tu inscripción quedó <strong>pendiente de aprobación</strong>.
            Inscribirte no garantiza tu lugar; te avisaremos por email cuando
            sea revisada. Mientras tanto, podés editarla o cancelarla con el
            enlace que te enviamos. Si no lo ves, revisá la carpeta de spam.
          </>
        ) : (
          <>
            Te enviamos un correo de confirmación con un enlace para editar o
            cancelar tu inscripción. Si no lo ves, revisá la carpeta de spam.
          </>
        )}
      </p>
      <Button asChild variant="outline" className="mt-2">
        <Link href="/">Volver al inicio</Link>
      </Button>
    </div>
  );
}
