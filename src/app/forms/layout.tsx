import PublicLayout from "@/components/organisms/layouts/public-layout";
import { SessionProvider } from "@/components/providers/session";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "next-themes";

/**
 * Páginas públicas de inscripción. Usan el mismo encabezado y pie que el sitio público
 * (`PublicLayout`, igual que `app/(public)/layout.tsx`): quien llega desde un link compartido
 * ve que está en el sitio de La Nube y tiene a mano el resto del sitio, como en una noticia.
 * Antes era una cáscara mínima (solo el logo) con todo en una tarjeta de 672 px, que en
 * escritorio se veía como la versión de teléfono.
 *
 * No está dentro de `(public)` a propósito: estas páginas leen la base en cada pedido
 * (cupos, estado del enlace) y `(public)` es estático/ISR (§19 de CLAUDE.md). El ancho de cada
 * página lo deciden `EventFormLayout` / `FormMessageCard` (`organisms/forms/form-page.tsx`).
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
      <SessionProvider>
        <PublicLayout>
          <div className="px-4 py-10 sm:px-8 sm:py-12">{children}</div>
        </PublicLayout>
      </SessionProvider>
      <Toaster />
    </ThemeProvider>
  );
}
