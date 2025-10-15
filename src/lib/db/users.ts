/** User profile helpers */
import { prisma } from "@/lib/prisma";

export async function getPublicUserByEmail(email: string) {
  return prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      name: true,
      lastName: true,
      email: true,
      dni: true,
      institution: true,
      reasonToJoin: true,
      role: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

export async function updateUserProfileByEmail(
  email: string,
  data: { name?: string; lastName?: string; dni?: string; institution?: string | null; reasonToJoin?: string }
) {
  // If DNI provided, ensure unique per user (skip same user)
  if (data.dni) {
    const existing = await prisma.user.findFirst({ where: { dni: data.dni, NOT: { email } } });
    if (existing) {
      throw new Error("DNI ya registrado por otro usuario");
    }
  }

  return prisma.user.update({
    where: { email },
    data: {
      name: data.name,
      lastName: data.lastName,
      dni: data.dni,
      institution: data.institution ?? null,
      reasonToJoin: data.reasonToJoin,
    },
    select: {
      id: true,
      name: true,
      lastName: true,
      email: true,
      dni: true,
      institution: true,
      reasonToJoin: true,
      role: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

import { Ban, RegisteredUser } from "@prisma/client";

interface RegisteredUserWithBans extends RegisteredUser {
  bans: Ban[];
}

async function createUser(user: RegisteredUser): Promise<RegisteredUser> {
  const newUser = await prisma.registeredUser.create({
    data: user,
  });
  return newUser;
}

async function getUserByEmail(email: string): Promise<RegisteredUserWithBans | null> {
  // Even though this is a find first, there's only one user with the given
  // email, so it'll be correct
  const user = await prisma.registeredUser.findFirst({
    relationLoadStrategy: 'join',
    include: {
      user: true,
      bans: {
        where: {
          OR: [
            { endTime: null },
            { endTime: { gt: new Date() } },
          ],
        },
        orderBy: {
          endTime: 'desc',
        },
        take: 1,
      },
    },
    where: { user: { email } },
  });
  return user ?? null;
}

async function updateUser(user: Omit<RegisteredUser, 'user'>): Promise<RegisteredUser> {
  const updatedUser = await prisma.registeredUser.update({
    where: { id: user.id },
    data: user,
  });
  return updatedUser;
}

async function banUser(ban: Ban): Promise<Ban> {
  const newBan = await prisma.ban.create({
    data: ban,
  });
  return newBan;
}

async function unbanUser(banId: string): Promise<Ban> {
  const deletedBan = await prisma.ban.delete({
    where: { id: banId },
  });
  return deletedBan;
}

async function getActiveUserBans(userId: string, limit: number, offset: number): Promise<Ban[]> {
  const take = Math.min(10, limit);
  const skip = Math.max(0, offset) * take;
  const bans = await prisma.ban.findMany({
    where: { userId, OR: [{ endTime: null }, { endTime: { gt: new Date() } }] },
    orderBy: { endTime: 'desc' },
    take,
    skip,
  });
  return bans;
}



export { banUser, createUser, getUserByEmail, unbanUser, updateUser };

