import { Button } from "@/components/ui/button";
import { CheckCircle2 } from "lucide-react";
import Link from "next/link";

export default function SubmittedPage() {
  return (
    <div className="flex flex-col items-center gap-4 py-6 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-la-nube-accent text-la-nube-selected dark:bg-la-nube-selected/30 dark:text-la-nube-secondary">
        <CheckCircle2 className="h-7 w-7" />
      </span>
      <h1 className="text-2xl font-bold">¡Listo, quedaste inscripto!</h1>
      <p className="max-w-prose text-muted-foreground">
        Te enviamos un correo de confirmación con un enlace para editar o
        cancelar tu inscripción. Si no lo ves, revisá la carpeta de spam.
      </p>
      <Button asChild variant="outline" className="mt-2">
        <Link href="/">Volver al inicio</Link>
      </Button>
    </div>
  );
}
