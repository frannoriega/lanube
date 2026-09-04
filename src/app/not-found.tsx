import Logo from "@/components/atoms/logos/lanube";
import ParticlesLayout from "@/components/organisms/layouts/particles-layout";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Home } from "lucide-react";
import Link from "next/link";

export default function NotFound() {
  return (
    <ParticlesLayout backgroundClass="bg-red-300" forceTheme="dark">
      <div className="flex min-h-[100svh] w-full items-center justify-center px-4 py-16">
        <Card className="w-full max-w-lg border-red-300 shadow-lg">
          <CardHeader className="flex flex-col items-center gap-4 text-center">
            <div className="flex w-fit items-center justify-center rounded-full bg-muted p-6">
              <Logo size={140} />
            </div>
            <span className="font-mono text-sm font-medium uppercase tracking-[0.2em] text-red-600">
              ~/ 404
              <span className="animate-blink">▌</span>
            </span>
            <CardTitle className="text-3xl font-bold">
              Espacio no encontrado
            </CardTitle>
            <CardDescription className="sr-only">
              La página que estás buscando no existe.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-6 text-center">
            <p className="max-w-prose text-pretty text-lg text-muted-foreground">
              La página que buscás no existe o cambió de lugar. Puede que el
              enlace esté roto o que el contenido se haya movido.
            </p>
            <div className="flex flex-col items-center gap-3 sm:flex-row">
              <Button asChild size="lg">
                <Link href="/">
                  <Home className="h-4 w-4" />
                  Volver al inicio
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="/user/dashboard">Ir a mi panel</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </ParticlesLayout>
  );
}
