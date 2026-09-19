import AlliesSection from "@/components/templates/landing/allies";
import EventsSection from "@/components/templates/landing/events";
import HeroSection from "@/components/templates/landing/hero";
import { EmojiShower } from "@/components/templates/landing/theme/emoji-shower";
import MembersSection from "@/components/templates/landing/members";
import NewsSection from "@/components/templates/landing/news";
import PartnersSection from "@/components/templates/landing/partners";
import SpacesSection from "@/components/templates/landing/spaces";
import { dateKeyFromUnixMs } from "@/lib/admin/admin-timezone";
import { nowMs } from "@/lib/clock";
import { BASE_KEYWORDS } from "@/lib/constants/hero";
import { getActiveLandingTheme } from "@/lib/db/landingThemes";
import {
  parseEmojiList,
  resolveHeroKeywords,
} from "@/lib/landing-themes/resolve";

export default async function Home() {
  const now = nowMs();
  const theme = await getActiveLandingTheme(now);
  const emojis = theme ? parseEmojiList(theme.emojiList) : [];
  const heroKeywords = theme
    ? resolveHeroKeywords(
        BASE_KEYWORDS,
        theme.heroKeywords,
        theme.heroKeywordsMode,
      )
    : BASE_KEYWORDS;

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
        keywords={heroKeywords}
      />
      {/* Right after the hero; hidden automatically when there are no upcoming events. */}
      <EventsSection />
      <NewsSection />
      <SpacesSection />
      <MembersSection />
      <PartnersSection />
      <AlliesSection />
    </div>
  );
}
