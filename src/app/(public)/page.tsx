import AlliesSection from "@/components/templates/landing/allies";
import EventsSection from "@/components/templates/landing/events";
import HeroSection from "@/components/templates/landing/hero";
import { EmojiShower } from "@/components/templates/landing/theme/emoji-shower";
import MembersSection from "@/components/templates/landing/members";
import PartnersSection from "@/components/templates/landing/partners";
import SpacesSection from "@/components/templates/landing/spaces";
import { dateKeyFromUnixMs } from "@/lib/admin/admin-timezone";
import { nowMs } from "@/lib/clock";
import { getActiveLandingTheme } from "@/lib/db/landingThemes";
import { parseEmojiList } from "@/lib/landing-themes/resolve";

export default async function Home() {
  const now = nowMs();
  const theme = await getActiveLandingTheme(now);
  const emojis = theme ? parseEmojiList(theme.emojiList) : [];

  // Each section owns its own <Breakout> and carries the alternating background (see
  // LANDING_SECTION_BG). Sections that have nothing to show return `null`, so the striping
  // stays correct — do not wrap them here in an extra always-rendered Breakout.
  return (
    <div className="flex flex-col w-full">
      {theme?.entranceEffect === "EMOJI_SHOWER" && emojis.length > 0 ? (
        <EmojiShower
          emojis={emojis}
          particleCount={theme.particleCount ?? 40}
          storageKey={`landing-theme-shown:${theme.id}:${dateKeyFromUnixMs(now)}`}
        />
      ) : null}
      <HeroSection
        eyebrowOverride={theme?.heroEyebrowOverride}
        extraKeyword={theme?.heroExtraKeyword}
      />
      {/* Right after the hero; hidden automatically when there are no upcoming events. */}
      <EventsSection />
      <SpacesSection />
      <MembersSection />
      <PartnersSection />
      <AlliesSection />
    </div>
  );
}
