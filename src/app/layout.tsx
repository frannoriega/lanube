import { ServerTimeProvider } from "@/components/providers/server-time";
import { auth } from "@/lib/auth";
import { nowMs } from "@/lib/clock";
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

  return (
    <html lang="es" suppressHydrationWarning>
      <body
        className={`${roboto.variable} ${robotoMono.variable} font-sans flex flex-col min-h-[100svh] antialiased transition-colors`}
      >
        <ServerTimeProvider serverNowMs={serverNowMs}>
          <SessionProvider session={session}>{children}</SessionProvider>
        </ServerTimeProvider>
      </body>
    </html>
  );
}
