import { SessionProvider } from "@/components/providers/session";
import PublicLayout from "@/components/organisms/layouts/public-layout";
import { ThemeProvider } from "next-themes";

/**
 * Public pages are prerendered and revalidated periodically (ISR) so the CDN can
 * cache them; DB-backed sections (e.g. upcoming events) refresh every 5 minutes.
 * No `session` is passed to the provider on purpose — the header's sign-in state
 * resolves client-side, keeping these routes static.
 */
export const revalidate = 300;

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
