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
      <Header />
      <div className="grow flex flex-col">{children}</div>
      <Footer className="self-end justify-self-end" />
    </ParticlesLayout>
  );
}
