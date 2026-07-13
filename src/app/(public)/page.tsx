import Breakout from "@/components/atoms/breakout";
import JsonLd from "@/components/atoms/json-ld";
import EventsSection from "@/components/templates/landing/events";
import HeroSection from "@/components/templates/landing/hero";
import MembersSection from "@/components/templates/landing/members";
import PartnersSection from "@/components/templates/landing/partners";
import SpacesSection from "@/components/templates/landing/spaces";
import {
  address,
  clickablePhone,
  email,
  socialMedia,
} from "@/lib/constants/contact";
import { siteDescription, siteName, siteUrl } from "@/lib/constants/site";
import type { Metadata } from "next";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

const homeJsonLd = [
  {
    "@context": "https://schema.org",
    // CoworkingSpace is the closest LocalBusiness subtype for the physical space.
    "@type": "CoworkingSpace",
    "@id": `${siteUrl}/#localbusiness`,
    name: siteName,
    alternateName: "La Nube",
    description: siteDescription,
    url: siteUrl,
    email,
    telephone: clickablePhone,
    address: {
      "@type": "PostalAddress",
      streetAddress: address.street,
      addressLocality: address.city,
      addressRegion: address.state,
      postalCode: address.zip,
      addressCountry: "AR",
    },
    sameAs: [socialMedia.instagram.url],
    parentOrganization: {
      "@type": "GovernmentOrganization",
      name: "Municipalidad de Concepción del Uruguay",
      url: "https://www.cdeluruguay.gob.ar/",
    },
  },
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${siteUrl}/#website`,
    name: siteName,
    url: siteUrl,
    inLanguage: "es-AR",
    publisher: { "@id": `${siteUrl}/#localbusiness` },
  },
];

export default function Home() {
  return (
    <div className="flex flex-col w-full">
      <JsonLd data={homeJsonLd} />
      <Breakout className=" odd:bg-transparent even:bg-la-nube-accent/40 dark:even:bg-la-nube-selected/15">
        <HeroSection />
      </Breakout>
      <Breakout className=" odd:bg-transparent even:bg-la-nube-accent/40 dark:even:bg-la-nube-selected/15">
        <SpacesSection />
      </Breakout>
      {/* Hidden automatically when there are no upcoming events. */}
      <Breakout className=" odd:bg-transparent even:bg-la-nube-accent/40 dark:even:bg-la-nube-selected/15">
        <EventsSection />
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
