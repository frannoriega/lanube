import Container from "@/components/atoms/container";
import ParticlesLayout from "../particles-layout";
import Footer from "./footer";
import Header from "./header";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ParticlesLayout className="grow flex flex-col items-stretch justify-start">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:bg-background focus:text-foreground focus:px-4 focus:py-2 focus:rounded-md focus:border focus:border-border focus:shadow-md focus:outline-none"
      >
        Ir al contenido principal
      </a>
      <Header />
      <main id="main-content">
        <Container>{children}</Container>
      </main>
      <Footer className="self-end justify-self-end" />
    </ParticlesLayout>
  );
}
