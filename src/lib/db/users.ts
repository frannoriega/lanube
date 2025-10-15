import { prisma } from "@/lib/prisma";
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

