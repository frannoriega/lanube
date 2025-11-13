import ParticlesLayout from "@/components/organisms/layouts/particles-layout";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "next-themes";
import { Suspense } from "react";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem forcedTheme="light">
      <ParticlesLayout backgroundClass="bg-la-nube-primary" forceTheme="dark">
        <Suspense>
          {children}
        </Suspense>
        <Toaster />
      </ParticlesLayout>
    </ThemeProvider>
  );
}
