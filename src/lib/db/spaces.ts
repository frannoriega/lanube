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

// ── Superadmin CRUD ───────────────────────────────────────────────────────────

export interface SpaceInput {
  name: string;
  slug: string;
  description: string;
  capacity: number;
  isExclusive: boolean;
  isReservable: boolean;
  isFeatured: boolean;
  displayOrder: number;
  iconName?: string | null;
  imageUrl?: string | null;
}

export async function createSpace(input: SpaceInput): Promise<Space> {
  return prisma.space.create({
    data: {
      ...input,
      iconName: input.iconName ?? null,
      imageUrl: input.imageUrl ?? null,
    },
  });
}

export async function updateSpace(
  id: string,
  input: SpaceInput,
): Promise<Space> {
  return prisma.space.update({
    where: { id },
    data: {
      ...input,
      iconName: input.iconName ?? null,
      imageUrl: input.imageUrl ?? null,
    },
  });
}

/**
 * Deletes a space. Refuses when events or reservations still reference it — the
 * Event FK cascades (would silently delete events) and the Reservation FK nulls out,
 * so an in-use space must be emptied explicitly first.
 */
export async function deleteSpace(id: string): Promise<void> {
  const [event, reservation] = await Promise.all([
    prisma.event.findFirst({ where: { spaceId: id }, select: { id: true } }),
    prisma.reservation.findFirst({
      where: { spaceId: id },
      select: { id: true },
    }),
  ]);
  if (event || reservation) {
    throw new Error(
      "El espacio tiene eventos o reservas asociadas y no puede eliminarse",
    );
  }
  await prisma.space.delete({ where: { id } });
}
