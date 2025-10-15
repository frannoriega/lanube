import ParticlesLayout from "@/components/organisms/layouts/particles-layout";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "next-themes";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem forcedTheme="light">
      <ParticlesLayout backgroundClass="bg-la-nube-primary" forceTheme="dark">
        {children}
        <Toaster />
      </ParticlesLayout>
    </ThemeProvider>
  );
}
