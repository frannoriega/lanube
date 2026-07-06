import { getSpaceIcon, getMetadataIcon } from "@/lib/constants/spaces";
import type { SpaceMetadataItem } from "@/lib/types/spaces";
import type { SpaceWithFungible } from "@/lib/db/spaces";
import type { LucideIcon } from "lucide-react";
import { Users } from "lucide-react";
import { LandingCard } from "../../shared/landing-card";
import { SpaceImagePanel } from "./space-image-panel";
import { Separator } from "@radix-ui/react-separator";

interface StatData {
  icon: LucideIcon;
  value?: string;
  label?: string;
  description?: string;
}

function buildStats(space: SpaceWithFungible, limit = 4): StatData[] {
  const metadata = (space.metadata ?? []) as SpaceMetadataItem[];
  const stats: StatData[] = [];

  for (const item of metadata.slice(0, limit)) {
    stats.push({
      icon: getMetadataIcon(item.icon),
      value:
        item.type === "stat"
          ? item.value
          : `${item.numerator} / ${item.denominator}`,
      label: item.label,
    });
  }

  return stats.slice(0, limit);
}

function StatBox({ icon: Icon, value }: StatData) {
  return (
    <div className="flex flex-row gap-2 items-center w-fit p-3 border-2 rounded-md">
      <Icon className="size-6 stroke-2 stroke-la-nube-secondary" />
      <span className="sm:block md:hidden lg:block w-full justify-start font-black">
        {value}
      </span>
    </div>
  );
}

export function SpaceCard({ space }: { space: SpaceWithFungible }) {
  const stats = buildStats(space, 4);
  const capacity = space.fungibleResource?.capacity;
  const href = space.isReservable
    ? `/user/${space.slug}`
    : `/spaces/${space.slug}`;
  const cta = space.isReservable ? "Reservar" : "Ver más";
  const Icon = space.iconName ? getSpaceIcon(space.iconName) : null;

  return (
    <LandingCard data={{ href, label: `${cta} ${space.name}` }}>
      <div className="flex min-h-37 flex-col md:flex-row">
        {/* Zone 1 — image */}
        <div className="relative h-44 shrink-0 overflow-hidden md:h-auto md:w-48">
          <SpaceImagePanel
            imageUrl={space.imageUrl}
            name={space.name}
            Icon={Icon}
            isFeatured={space.isFeatured}
          />
        </div>

        {/* Zone 2 — name → stat chips → description → CTA */}
        <div className="flex flex-1 flex-col justify-between gap-3 p-5">
          <div className="flex flex-col gap-2">
            <h3 className="text-3xl font-bold leading-snug">
              [ {space.name} ]
            </h3>
            <Separator
              orientation="horizontal"
              className="h-px bg-muted-foreground"
            />
            <p className="line-clamp-2 text-lg text-muted-foreground">
              {space.description.split("\n")[0]}
            </p>
          </div>
          <div className="flex flex-row flex-wrap gap-2 items-center justify-start">
            {stats.map((s, i) => (
              <StatBox key={i} {...s} />
            ))}
          </div>
        </div>

        <div className="p-4">
          <div className="flex flex-col w-full md:w-48 p-4 border-2 rounded-md">
            <div className="flex flex-row w-full items-start justify-between">
              <span className="text-muted-foreground">[ Capacidad ]</span>
              <div className="justify-end">
                <Users className="size-10 stroke-2 stroke-la-nube-secondary" />
              </div>
            </div>
            <div className="flex flex-col gap-2 w-full items-center">
              <span className="w-full justify-start text-6xl font-black">
                {capacity}
              </span>
              <Separator
                orientation="horizontal"
                className="w-full h-px bg-muted-foreground"
              />
              <span className="w-full justify-start font-bold">Personas</span>
            </div>
          </div>
        </div>
      </div>
    </LandingCard>
  );
}
