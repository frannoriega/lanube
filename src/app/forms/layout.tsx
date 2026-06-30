import Logo from "@/components/atoms/logos/lanube";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "next-themes";
import Link from "next/link";

/**
 * Focused, branded shell for the public registration pages. Intentionally chrome-light
 * (logo only, no nav) so a participant who follows the link has a single job: register.
 */
export default function FormsLayout({
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

        <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-16">
          <div className="rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
            {children}
          </div>
        </main>

        <footer className="mx-auto w-full max-w-2xl px-4 pb-8">
          <p className="font-mono text-xs text-muted-foreground">
            ~/ la nube · polo tecnológico
          </p>
        </footer>
      </div>
      <Toaster />
    </ThemeProvider>
  );
}
