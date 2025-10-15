import ParticlesLayout from "../particles-layout";
import Footer from "./footer";
import Header from "./header";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
    return (
        <ParticlesLayout className="h-full flex flex-col items-start justify-start">
            <Header />
            {children}
            <Footer />
        </ParticlesLayout>
    )
}