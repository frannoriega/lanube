import { DomainError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import type { Space } from "@/generated/prisma/client";
import type { SpaceFaq } from "@/lib/types/spaces";
import { Prisma } from "@/generated/prisma/client";

export type { Space };

/** Reads the JSON `faqs` column back as a typed array (empty when unset/invalid). */
export function getSpaceFaqs(space: Pick<Space, "faqs">): SpaceFaq[] {
  return Array.isArray(space.faqs) ? (space.faqs as unknown as SpaceFaq[]) : [];
}
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
  longDescription?: string | null;
  faqs?: SpaceFaq[];
  capacity: number;
  isExclusive: boolean;
  isReservable: boolean;
  isFeatured: boolean;
  displayOrder: number;
  iconName?: string | null;
  imageUrl?: string | null;
}

/** Normalizes the JSON/nullable columns shared by create + update. */
function toSpaceData(input: SpaceInput) {
  const { faqs, longDescription, iconName, imageUrl, ...rest } = input;
  return {
    ...rest,
    longDescription: longDescription?.trim() ? longDescription : null,
    faqs: (faqs ?? []) as unknown as Prisma.InputJsonValue,
    iconName: iconName ?? null,
    imageUrl: imageUrl ?? null,
  };
}

export async function createSpace(input: SpaceInput): Promise<Space> {
  // New spaces go to the end; ordering is managed via the up/down controls.
  const last = await prisma.space.aggregate({ _max: { displayOrder: true } });
  const displayOrder = (last._max.displayOrder ?? -1) + 1;
  return prisma.space.create({
    data: { ...toSpaceData(input), displayOrder },
  });
}

export async function updateSpace(
  id: string,
  input: SpaceInput,
): Promise<Space> {
  return prisma.space.update({
    where: { id },
    data: toSpaceData(input),
  });
}

/**
 * Persists a new ordering for spaces. `orderedIds` is the full list of space ids in the
 * desired top-to-bottom order; each space's `displayOrder` is rewritten to its index so the
 * values stay dense (0..n-1). Ids not present in the DB are ignored.
 */
export async function reorderSpaces(orderedIds: string[]): Promise<void> {
  await prisma.$transaction(
    orderedIds.map((id, index) =>
      prisma.space.update({
        where: { id },
        data: { displayOrder: index },
      }),
    ),
  );
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
    throw new DomainError(
      "El espacio tiene eventos o reservas asociadas y no puede eliminarse",
      409,
    );
  }
  await prisma.space.delete({ where: { id } });
}
