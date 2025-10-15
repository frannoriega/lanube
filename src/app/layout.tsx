import { SessionProvider } from "@/components/providers/session/session-provider";
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
  title: "La Nube - Coworking & Innovation Space",
  description: "Sistema de gestión para el espacio de coworking La Nube",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body
        className={`${roboto.variable} ${robotoMono.variable} font-sans h-full antialiased -z-100 bg-slate-100 dark:bg-slate-800 transition-colors`}
      >
        <SessionProvider>
            {children}
        </SessionProvider>
      </body>
    </html>
  );
}
