import { siteDescription, siteName, siteUrl } from "@/lib/constants/site";
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
  metadataBase: new URL(siteUrl),
  title: {
    default: "La Nube - Polo Tecnológico de Concepción del Uruguay",
    template: `%s | ${siteName}`,
  },
  description: siteDescription,
  openGraph: {
    type: "website",
    locale: "es_AR",
    siteName,
    title: "La Nube - Polo Tecnológico de Concepción del Uruguay",
    description: siteDescription,
  },
  twitter: {
    card: "summary_large_image",
  },
};

/**
 * Intentionally static (no `connection()`/`auth()`): keeping the root layout free of
 * dynamic APIs lets the public pages prerender + cache at the CDN. The session and
 * server-time providers live in the `(management)` layout, which is dynamic.
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body
        className={`${roboto.variable} ${robotoMono.variable} font-sans flex flex-col min-h-[100svh] antialiased transition-colors`}
      >
        {children}
      </body>
    </html>
  );
}
