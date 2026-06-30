import EventsSection from "@/components/templates/landing/events";
import HeroSection from "@/components/templates/landing/hero";
import MembersSection from "@/components/templates/landing/members";
import PartnersSection from "@/components/templates/landing/partners";
import ServicesSection from "@/components/templates/landing/services";

export default function Home() {
  return (
    <div className="flex flex-col w-full">
      <HeroSection />
      <ServicesSection />
      {/* Hidden automatically when there are no upcoming events. */}
      <EventsSection />
      <MembersSection />
      <PartnersSection />
    </div>
  );
}
