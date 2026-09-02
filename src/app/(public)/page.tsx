import EventsSection from "@/components/templates/landing/events";
import HeroSection from "@/components/templates/landing/hero";
import MembersSection from "@/components/templates/landing/members";
import PartnersSection from "@/components/templates/landing/partners";
import SpacesSection from "@/components/templates/landing/spaces";

export default function Home() {
  // Each section owns its own <Breakout> and carries the alternating background (see
  // LANDING_SECTION_BG). Sections that have nothing to show return `null`, so the striping
  // stays correct — do not wrap them here in an extra always-rendered Breakout.
  return (
    <div className="flex flex-col w-full">
      <HeroSection />
      {/* Right after the hero; hidden automatically when there are no upcoming events. */}
      <EventsSection />
      <SpacesSection />
      <MembersSection />
      <PartnersSection />
    </div>
  );
}
