import { prisma } from "@/lib/prisma";
import type { Resource } from "@/generated/prisma/client";

export type { Resource };

/** Physical resources (equipment inventory), managed by superadmins. */
export async function listResources(): Promise<Resource[]> {
  return prisma.resource.findMany({ orderBy: { name: "asc" } });
}

export interface ResourceInput {
  name: string;
  serialNumber?: string | null;
}

export async function createResource(input: ResourceInput): Promise<Resource> {
  return prisma.resource.create({
    data: { name: input.name, serialNumber: input.serialNumber || null },
  });
}

export async function updateResource(
  id: string,
  input: ResourceInput,
): Promise<Resource> {
  return prisma.resource.update({
    where: { id },
    data: { name: input.name, serialNumber: input.serialNumber || null },
  });
}

export async function deleteResource(id: string): Promise<void> {
  await prisma.resource.delete({ where: { id } });
}
