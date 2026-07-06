import { prisma } from "@/lib/prisma";
import type { FungibleResource, Space } from "@/generated/prisma/client";

export type SpaceWithFungible = Space & {
  fungibleResource: FungibleResource | null;
};

export async function getPublicSpaces(): Promise<SpaceWithFungible[]> {
  return prisma.space.findMany({
    orderBy: { displayOrder: "asc" },
    include: { fungibleResource: true },
  });
}

export async function getSpaceBySlug(
  slug: string,
): Promise<SpaceWithFungible | null> {
  return prisma.space.findUnique({
    where: { slug },
    include: { fungibleResource: true },
  });
}
