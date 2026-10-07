import { MaintenanceProvider } from "@/components/providers/maintenance";
import { WhatsAppFloatButton } from "@/components/molecules/whatsapp-float-button";
import { getPublicSiteConfig } from "@/lib/cache/public-reads";
import type { Metadata } from "next";
import { Roboto, Roboto_Mono } from "next/font/google";
import "./globals.css";

const roboto = Roboto({
  variable: "--font-roboto",
  subsets: ["latin"],
  weight: ["300", "400", "500", "700", "900"],
});

const robotoMono = Roboto_Mono({
  variable: "--font-roboto-mono",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: "La Nube - Polo Tecnológico",
  description: 'Espacio de coworking e innovación "La Nube"',
};

/**
 * Layout raíz. **No puede depender del pedido** (milestone 25, P2): antes hacía
 * `connection()`, `auth()` y `getSiteConfig()`, y eso volvía dinámica cada página del sitio —
 * ninguna se podía prerenderizar ni cachear. Lo que dependía del pedido se mudó:
 *
 * - la hora del servidor (`ServerTimeProvider`) y la sesión resuelta en el servidor, a
 *   `(management)/layout.tsx` (sus únicos consumidores están ahí);
 * - la sesión del sitio público, a `(public)/layout.tsx`, que la pide desde el navegador;
 * - la configuración del sitio (teléfono del botón de WhatsApp), a una lectura cacheada con tag
 *   (`getPublicSiteConfig`), que invalida el PUT de `/api/admin/site-config`.
 *
 * No agregar acá `auth()`, `cookies()`, `headers()`, `connection()` ni lecturas sin caché.
 */
export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const siteConfig = await getPublicSiteConfig();

  return (
    <html lang="es" suppressHydrationWarning>
      <body
        className={`${roboto.variable} ${robotoMono.variable} font-sans flex flex-col min-h-[100svh] antialiased transition-colors`}
      >
        {/* Skip link (WCAG 2.4.1). Without it a keyboard user tabs through the whole
            sidebar before reaching any admin page's content. Visually hidden until
            focused, and it is deliberately the first focusable element in the document. */}
        <a
          href="#main-content"
          className="sr-only rounded-md bg-la-nube-selected px-4 py-2 text-white focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100]"
        >
          Saltar al contenido
        </a>
        <MaintenanceProvider>{children}</MaintenanceProvider>
        <WhatsAppFloatButton phoneClickable={siteConfig.phoneClickable} />
      </body>
    </html>
  );
}
