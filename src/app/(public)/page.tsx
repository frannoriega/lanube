import HeroSection from "@/components/templates/landing/hero";
import ServicesSection from "@/components/templates/landing/services";

export default function Home() {
    return (
        <div className="flex flex-col w-full">
            <HeroSection />
            <ServicesSection />
            {/* <EventsSection />
            <NewsSection /> */}
        </div>
    )
}