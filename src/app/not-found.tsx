import Logo from "@/components/atoms/logos/lanube";
import ParticlesLayout from "@/components/organisms/layouts/particles-layout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <ParticlesLayout backgroundClass="bg-red-300" forceTheme="light">
        <Card className="bg-red-600/10 backdrop-blur-xs border-red-400/20 shadow-lg">
          <CardHeader>
            <CardTitle className="flex flex-col items-center gap-4">
              <div className="flex flex-col items-center bg-slate-100 p-8 w-fit rounded-full">
                <Logo size={200} />
              </div>
              <h1 className="text-xl font-bold">404 - Página no encontrada</h1>
            </CardTitle>
            <CardDescription className="sr-only">
              La página que estás buscando no existe.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-2">
            <p>La página que estás buscando no existe.</p>
            <p>Si crees que es un error, por favor contacta a soporte.</p>
          </CardContent>
        </Card>
      </ParticlesLayout>
    </div>
  );
}
