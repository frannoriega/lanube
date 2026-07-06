import { prisma } from "@/lib/prisma";
import type { Space } from "@/generated/prisma/client";

export type { Space };
/** Backward-compat alias — Space now includes capacity directly. */
export type SpaceWithFungible = Space;

export async function getPublicSpaces(): Promise<Space[]> {
  return prisma.space.findMany({
    orderBy: { displayOrder: "asc" },
  });
}

export async function getSpaceBySlug(slug: string): Promise<Space | null> {
  return prisma.space.findUnique({ where: { slug } });
}

export async function getSpaceById(id: string): Promise<Space | null> {
  return prisma.space.findUnique({ where: { id } });
}

export async function getReservableSpaces(): Promise<Space[]> {
  return prisma.space.findMany({
    where: { isReservable: true },
    orderBy: { displayOrder: "asc" },
  });
}
