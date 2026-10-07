import PublicLayout from "@/components/organisms/layouts/public-layout";
import { SessionProvider } from "@/components/providers/session";
import { ThemeProvider } from "next-themes";

/**
 * Sitio público. Estático/ISR desde el milestone 25 (P2): nada de lo que se renderiza acá puede
 * depender del pedido. La sesión (botón «Ingresar» / «Mi panel» del encabezado) se pide desde el
 * navegador — `SessionProvider` sin `session`.
 */
export default function RootLayout({
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
        <PublicLayout>{children}</PublicLayout>
      </SessionProvider>
    </ThemeProvider>
  );
}
