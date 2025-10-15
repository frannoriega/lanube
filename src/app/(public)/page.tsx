import EventsSection from "@/components/templates/landing/events";
import HeroSection from "@/components/templates/landing/hero";
import NewsSection from "@/components/templates/landing/news";
import ServicesSection from "@/components/templates/landing/services";

export default function Home() {
    return (
        <div className="flex flex-col h-full w-full">
            <HeroSection />
            <ServicesSection />
            <EventsSection />
            <NewsSection />
        </div>
    )
}