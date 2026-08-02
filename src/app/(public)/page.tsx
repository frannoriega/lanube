import Breakout from "@/components/atoms/breakout";
import EventsSection from "@/components/templates/landing/events";
import HeroSection from "@/components/templates/landing/hero";
import MembersSection from "@/components/templates/landing/members";
import PartnersSection from "@/components/templates/landing/partners";
import SpacesSection from "@/components/templates/landing/spaces";

export default function Home() {
  return (
    <div className="flex flex-col w-full">
      <Breakout className=" odd:bg-transparent even:bg-la-nube-accent/40 dark:even:bg-la-nube-selected/15">
        <HeroSection />
      </Breakout>
      {/* Right after the hero; hidden automatically when there are no upcoming events. */}
      <Breakout className=" odd:bg-transparent even:bg-la-nube-accent/40 dark:even:bg-la-nube-selected/15">
        <EventsSection />
      </Breakout>
      <Breakout className=" odd:bg-transparent even:bg-la-nube-accent/40 dark:even:bg-la-nube-selected/15">
        <SpacesSection />
      </Breakout>
      <Breakout className=" odd:bg-transparent even:bg-la-nube-accent/40 dark:even:bg-la-nube-selected/15">
        <MembersSection />
      </Breakout>
      <Breakout className=" odd:bg-transparent even:bg-la-nube-accent/40 dark:even:bg-la-nube-selected/15">
        <PartnersSection />
      </Breakout>
    </div>
  );
}
