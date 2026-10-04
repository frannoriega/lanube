import Logo from "@/components/atoms/logos/lanube";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "next-themes";
import Link from "next/link";

/**
 * Shell de las pantallas que se interponen antes de usar la zona autenticada — hoy, solo
 * "Actualizamos nuestras políticas" (milestone 19). Mismo estilo que el de `/forms`: logo y
 * nada más, porque la persona tiene una sola cosa que hacer acá. No usa el layout de gestión
 * (que asume un usuario ya habilitado) ni el público (su navegación invita a irse).
 */
export default function GateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      storageKey="la-nube-theme"
    >
      <div className="flex min-h-[100svh] flex-col bg-background bg-gradient-to-b from-la-nube-accent/40 to-transparent dark:from-la-nube-selected/10">
        <header className="mx-auto flex w-full max-w-2xl items-center px-4 py-6">
          <Link href="/" aria-label="Ir al inicio de La Nube">
            <Logo size={110} />
          </Link>
        </header>
        <main
          id="main-content"
          className="mx-auto w-full max-w-2xl flex-1 px-4 pb-16"
        >
          <div className="rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
            {children}
          </div>
        </main>
      </div>
      <Toaster />
    </ThemeProvider>
  );
}
