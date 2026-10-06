import { MaintenanceProvider } from "@/components/providers/maintenance";
import { ServerTimeProvider } from "@/components/providers/server-time";
import { WhatsAppFloatButton } from "@/components/molecules/whatsapp-float-button";
import { auth } from "@/lib/auth";
import { nowMs } from "@/lib/clock";
import { getSiteConfig } from "@/lib/db/siteConfig";
import { SessionProvider } from "@/components/providers/session";
import type { Metadata } from "next";
import { connection } from "next/server";
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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await connection();
  const serverNowMs = nowMs();
  const session = await auth();
  const siteConfig = await getSiteConfig();

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
        <ServerTimeProvider serverNowMs={serverNowMs}>
          <SessionProvider session={session}>
            <MaintenanceProvider>{children}</MaintenanceProvider>
          </SessionProvider>
        </ServerTimeProvider>
        <WhatsAppFloatButton phoneClickable={siteConfig.phoneClickable} />
      </body>
    </html>
  );
}
