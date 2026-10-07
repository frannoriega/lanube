import AlliesSection from "@/components/templates/landing/allies";
import ClosingCta from "@/components/templates/landing/cta";
import EventsSection from "@/components/templates/landing/events";
import HeroSection from "@/components/templates/landing/hero";
import { EmojiShower } from "@/components/templates/landing/theme/emoji-shower";
import MembersSection from "@/components/templates/landing/members";
import NewsSection from "@/components/templates/landing/news";
import PartnersSection from "@/components/templates/landing/partners";
import AmenitiesSection from "@/components/templates/landing/amenities";
import SpacesSection from "@/components/templates/landing/spaces";
import { dateKeyFromUnixMs } from "@/lib/admin/admin-timezone";
import { nowMs } from "@/lib/clock";
import { BASE_KEYWORDS } from "@/lib/constants/hero";
import { getPublicLandingThemes } from "@/lib/cache/public-reads";
import {
  parseEmojiList,
  resolveActiveTheme,
  resolveHeroKeywords,
} from "@/lib/landing-themes/resolve";

/**
 * ISR (milestone 25, P2): se genera una vez y se regenera a lo sumo cada
 * `PUBLIC_REVALIDATE_SECONDS`; las escrituras del panel la invalidan antes por tag (ver
 * `src/lib/cache/public-reads.ts`). El tema del día y los eventos próximos dependen del reloj:
 * los cubre ese vencimiento.
 */
// Next exige un literal: `public-cache.test.ts` comprueba que sea igual a PUBLIC_REVALIDATE_SECONDS.
export const revalidate = 300;

export default async function Home() {
  const now = nowMs();
  const theme = resolveActiveTheme(await getPublicLandingThemes(), now);
  const emojis = theme ? parseEmojiList(theme.emojiList) : [];
  const heroKeywords = theme
    ? resolveHeroKeywords(
        BASE_KEYWORDS,
        theme.heroKeywords,
        theme.heroKeywordsMode,
      )
    : BASE_KEYWORDS;

  // Each section owns its own <Breakout> and carries the alternating background (see
  // LANDING_SECTION_BG, which uses real CSS nth-child odd/even). Sections that have
  // nothing to show return `null`, so the striping stays correct — do not wrap them
  // here in an extra always-rendered Breakout, and do not add any other conditionally
  // rendered sibling inside the sections container below: nth-child counts every DOM
  // child of that container, visible or not (a `position: fixed` overlay still counts),
  // so an extra sibling shifts every section's parity — including Hero's — for as long
  // as it's present. EmojiShower is a `position: fixed` full-viewport overlay with no
  // layout footprint of its own, so it renders as a sibling of (outside) that container.
  //
  // Milestone 18 (experimento de marca): `ClosingCta` es siempre visible y pinta su propio
  // fondo, así que no usa LANDING_SECTION_BG pero sí ocupa un lugar en el conteo de nth-child
  // (es el último, así que no corre la paridad de nadie). La franja de cifras que iba entre
  // Eventos y Noticias se quitó tras revisarla (ver `StatsBand`).
  return (
    <>
      {theme?.entranceEffect === "EMOJI_SHOWER" && emojis.length > 0 ? (
        <EmojiShower
          emojis={emojis}
          particleCount={theme.particleCount ?? 40}
          storageKey={`landing-theme-shown:${theme.id}:${dateKeyFromUnixMs(now)}`}
        />
      ) : null}
      <div className="flex flex-col w-full">
        <HeroSection
          eyebrowOverride={theme?.heroEyebrowOverride}
          keywords={heroKeywords}
        />
        {/* Right after the hero; hidden automatically when there are no upcoming events. */}
        <EventsSection />
        <NewsSection />
        <SpacesSection />
        <AmenitiesSection />
        <MembersSection />
        <PartnersSection />
        <AlliesSection />
        <ClosingCta />
      </div>
    </>
  );
}
