import { DomainError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import type { Space, SpaceKind } from "@/generated/prisma/client";
import type { SpaceFaq } from "@/lib/types/spaces";
import { Prisma } from "@/generated/prisma/client";

export type { Space };

/** Reads the JSON `faqs` column back as a typed array (empty when unset/invalid). */
export function getSpaceFaqs(space: Pick<Space, "faqs">): SpaceFaq[] {
  return Array.isArray(space.faqs) ? (space.faqs as unknown as SpaceFaq[]) : [];
}
/** Backward-compat alias — Space now includes capacity directly. */
export type SpaceWithFungible = Space;

/**
 * Todo lo que se muestra en el sitio, **espacios y áreas comunes juntos** (milestone 24).
 * Quien necesite solo lugares reservables o donde cargar eventos NO debe usar esta: pase por
 * `getSpacesByKind("SPACE")` (un test impide que reaparezca en esos lugares).
 */
export async function getPublicSpaces(): Promise<Space[]> {
  return prisma.space.findMany({
    orderBy: { displayOrder: "asc" },
  });
}

/** Los registros de un solo tipo, en el orden del panel (`displayOrder`). */
export async function getSpacesByKind(kind: SpaceKind): Promise<Space[]> {
  return prisma.space.findMany({
    where: { kind },
    orderBy: { displayOrder: "asc" },
  });
}

/** Áreas comunes (cocina, jardín, living…): se muestran, no se reservan. */
export function getPublicAmenities(): Promise<Space[]> {
  return getSpacesByKind("AMENITY");
}

export async function getSpaceBySlug(slug: string): Promise<Space | null> {
  return prisma.space.findUnique({ where: { slug } });
}

export async function getSpaceById(id: string): Promise<Space | null> {
  return prisma.space.findUnique({ where: { id } });
}

export async function getReservableSpaces(): Promise<Space[]> {
  return prisma.space.findMany({
    // `kind` además de `isReservable`: el CHECK de la base ya lo garantiza, pero así la
    // intención se lee en la consulta.
    where: { isReservable: true, kind: "SPACE" },
    orderBy: { displayOrder: "asc" },
  });
}

// ── Superadmin CRUD ───────────────────────────────────────────────────────────

export interface SpaceInput {
  /** Se elige al crear y no cambia después (ver `updateSpace`). */
  kind?: SpaceKind;
  name: string;
  slug: string;
  description: string;
  longDescription?: string | null;
  faqs?: SpaceFaq[];
  /** `null` = sin capacidad; solo válido para un área común. */
  capacity: number | null;
  isExclusive: boolean;
  isReservable: boolean;
  isFeatured: boolean;
  /** Ignorado: el orden se cambia solo con `reorderSpaces` (modo "Reordenar"). */
  displayOrder?: number;
  iconName?: string | null;
  imageUrl?: string | null;
}

/** Normalizes the JSON/nullable columns shared by create + update. */
function toSpaceData(input: SpaceInput) {
  // `displayOrder` se descarta a propósito: al crear se agrega al final (ver `createSpace`) y al
  // editar no se toca, así guardar el formulario nunca pisa un orden hecho con "Reordenar".
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { faqs, longDescription, iconName, imageUrl, displayOrder, ...rest } =
    input;
  // Una área común nunca se reserva ni es exclusiva (lo exige también un CHECK en la base).
  const amenity = rest.kind === "AMENITY";
  return {
    ...rest,
    ...(amenity ? { isReservable: false, isExclusive: false } : {}),
    longDescription: longDescription?.trim() ? longDescription : null,
    faqs: (faqs ?? []) as unknown as Prisma.InputJsonValue,
    iconName: iconName ?? null,
    imageUrl: imageUrl ?? null,
  };
}

/**
 * Slug libre para un espacio nuevo (milestone 14): el formulario lo deriva del nombre y ya no
 * se tipea, así que una colisión no debe ser un error sino un sufijo numérico
 * (`sala-de-reuniones-2`), igual que en Noticias. Solo se usa al **crear**: al editar el slug
 * queda estable (está en `/user/spaces/<slug>` y en links compartidos).
 */
async function uniqueSpaceSlug(base: string): Promise<string> {
  const root = base || "espacio";
  let slug = root;
  for (let i = 2; ; i++) {
    const taken = await prisma.space.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (!taken) return slug;
    slug = `${root}-${i}`;
  }
}

export async function createSpace(input: SpaceInput): Promise<Space> {
  // New spaces go to the end; ordering is managed via the "Reordenar" mode.
  const last = await prisma.space.aggregate({ _max: { displayOrder: true } });
  const displayOrder = (last._max.displayOrder ?? -1) + 1;
  const slug = await uniqueSpaceSlug(input.slug);
  return prisma.space.create({
    data: { ...toSpaceData(input), slug, displayOrder },
  });
}

export async function updateSpace(
  id: string,
  input: SpaceInput,
): Promise<Space> {
  // El tipo no se cambia al editar: pasar de espacio a área común (o al revés) con reservas,
  // eventos y links por medio es una migración de datos, no una edición. Se ignora lo que
  // llegue y se conserva el guardado; el formulario ni lo ofrece.
  const existing = await prisma.space.findUnique({
    where: { id },
    select: { kind: true },
  });
  if (!existing) throw new DomainError("Espacio no encontrado", 404);
  return prisma.space.update({
    where: { id },
    data: toSpaceData({ ...input, kind: existing.kind }),
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
