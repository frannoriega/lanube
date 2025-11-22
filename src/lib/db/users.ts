/** User profile helpers */
import { prisma } from "@/lib/prisma";
import { Ban, Prisma, RegisteredUser, User } from "@prisma/client";
import bcrypt from "bcryptjs";
import { startOfMonth } from "date-fns";

interface WrongPasswordError extends Error {
  message: "Contraseña incorrecta";
}

type RegisteredUserListRow = RegisteredUser & {
  user: {
    email: string;
  };
  bans: Ban[];
};

export type UsersOrderableField =
  | "name"
  | "lastName"
  | "email"
  | "dni"
  | "institution"
  | "role"
  | "createdAt";

export type UsersOrderDirection = "asc" | "desc";

export interface GetUsersOptions {
  limit?: number;
  offset?: number;
  search?: string;
  orderBy?: UsersOrderableField;
  orderDirection?: UsersOrderDirection;
}

export interface GetUsersResult {
  total: number;
  users: Array<{
    id: string;
    name: string;
    lastName: string;
    dni: string;
    institution: string | null;
    role: string;
    createdAt: Date;
    updatedAt: Date;
    email: string;
    status: "ACTIVE" | "BANNED";
  }>;
}

export interface UsersSummary {
  totalUsers: number;
  activeUsers: number;
  bannedUsers: number;
  monthUsers: number;
}

const ORDERABLE_FIELD_MAP: Record<
  UsersOrderableField,
  "name" | "lastName" | "dni" | "institution" | "role" | "createdAt" | "email"
> = {
  name: "name",
  lastName: "lastName",
  dni: "dni",
  institution: "institution",
  role: "role",
  createdAt: "createdAt",
  email: "email",
};

export async function getRegisteredUserById(
  id: string,
): Promise<RegisteredUser | null> {
  return prisma.registeredUser.findUnique({
    where: { id },
  });
}

export async function getRegisteredUsers({
  limit,
  offset,
  search,
  orderBy,
  orderDirection,
}: GetUsersOptions = {}): Promise<GetUsersResult> {
  const safeLimit = Math.min(50, Math.max(1, Math.floor(limit ?? 10)));
  const safeOffset = Math.max(0, Math.floor(offset ?? 0));
  const direction: UsersOrderDirection =
    orderDirection === "desc" ? "desc" : "asc";
  const trimmedSearch = search?.trim();
  const where: Prisma.RegisteredUserWhereInput | undefined = trimmedSearch
    ? {
        OR: [
          {
            name: {
              contains: trimmedSearch,
              mode: "insensitive",
            },
          },
          {
            lastName: {
              contains: trimmedSearch,
              mode: "insensitive",
            },
          },
          {
            dni: {
              contains: trimmedSearch,
              mode: "insensitive",
            },
          },
          {
            institution: {
              contains: trimmedSearch,
              mode: "insensitive",
            },
          },
          {
            user: {
              email: {
                contains: trimmedSearch,
                mode: "insensitive",
              },
            },
          },
        ],
      }
    : undefined;

  const [total, rows] = await Promise.all([
    prisma.registeredUser.count({ where }),
    prisma.registeredUser.findMany({
      where,
      include: {
        user: {
          select: {
            email: true,
          },
        },
        bans: {
          where: {
            OR: [{ endTime: null }, { endTime: { gt: new Date() } }],
          },
          orderBy: {
            endTime: "desc",
          },
          take: 1,
        },
      },
      take: safeLimit,
      skip: safeOffset,
      orderBy: (() => {
        const normalizedOrderBy: UsersOrderableField = orderBy ?? "createdAt";
        const orderField = ORDERABLE_FIELD_MAP[normalizedOrderBy];

        if (orderField === "email") {
          return [
            {
              user: {
                email: direction,
              },
            },
            { createdAt: direction },
          ];
        }

        if (orderField === "createdAt") {
          return [
            {
              createdAt: direction,
            },
          ];
        }

        return [
          {
            [orderField]: direction,
          } as Prisma.RegisteredUserOrderByWithRelationInput,
          { createdAt: direction },
        ];
      })(),
    }),
  ]);

  const now = Date.now();
  const payload: GetUsersResult["users"] = rows.map(
    (user: RegisteredUserListRow) => {
      const activeBan = user.bans[0] ?? null;
      const isBanned =
        !!activeBan &&
        (!activeBan.endTime || activeBan.endTime.getTime() > now);

      return {
        id: user.id,
        name: user.name,
        lastName: user.lastName,
        dni: user.dni,
        institution: user.institution ?? null,
        role: user.role,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        email: user.user.email,
        status: isBanned ? "BANNED" : "ACTIVE",
      };
    },
  );

  return {
    total,
    users: payload,
  };
}

export async function getRegisteredUsersSummary(): Promise<UsersSummary> {
  const now = new Date();
  const monthStart = startOfMonth(now);

  const [totalUsers, bannedUsers, monthUsers] = await Promise.all([
    prisma.registeredUser.count(),
    prisma.registeredUser.count({
      where: {
        bans: {
          some: {
            OR: [{ endTime: null }, { endTime: { gt: now } }],
          },
        },
      },
    }),
    prisma.registeredUser.count({
      where: {
        createdAt: {
          gte: monthStart,
        },
      },
    }),
  ]);

  return {
    totalUsers,
    bannedUsers,
    activeUsers: Math.max(totalUsers - bannedUsers, 0),
    monthUsers,
  };
}

export async function updateRegisteredUserProfileByEmail(
  email: string,
  data: {
    name?: string;
    lastName?: string;
    dni?: string;
    institution?: string | null;
    reasonToJoin?: string;
  },
) {
  const currentUser = await prisma.registeredUser.findFirst({
    where: { user: { email } },
    select: { id: true },
  });

  if (!currentUser) {
    throw new Error("Usuario no encontrado");
  }

  // If DNI provided, ensure unique per user (skip same user)
  if (data.dni) {
    const existing = await prisma.registeredUser.findFirst({
      where: {
        dni: data.dni,
        user: {
          email: {
            not: email,
          },
        },
      },
      select: { id: true },
    });
    if (existing) {
      throw new Error("DNI ya registrado por otro usuario");
    }
  }

  const updated = await prisma.registeredUser.update({
    where: { id: currentUser.id },
    data: {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.lastName !== undefined ? { lastName: data.lastName } : {}),
      ...(data.dni !== undefined ? { dni: data.dni } : {}),
      ...(data.institution !== undefined
        ? { institution: data.institution ?? null }
        : {}),
      ...(data.reasonToJoin !== undefined
        ? { reasonToJoin: data.reasonToJoin }
        : {}),
    },
    include: {
      user: {
        select: { email: true },
      },
    },
  });

  return {
    id: updated.id,
    name: updated.name,
    lastName: updated.lastName,
    email: updated.user.email,
    dni: updated.dni,
    institution: updated.institution ?? null,
    reasonToJoin: updated.reasonToJoin,
    role: updated.role,
    createdAt: updated.createdAt,
    updatedAt: updated.updatedAt,
  };
}

interface RegisteredUserWithBans extends RegisteredUser {
  user: User;
  bans: Ban[];
}

async function createUser(email: string, password: string): Promise<User> {
  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
    },
  });
  return user;
}

async function getUserByEmailAndPassword(
  email: string,
  password: string,
): Promise<User | null> {
  const user = await prisma.user.findFirst({
    where: { email },
  });
  if (!user) {
    return null;
  }
  if (
    user.passwordHash &&
    (await bcrypt.compare(password, user.passwordHash))
  ) {
    return user;
  }
  return null;
}

async function getRegisteredUserByEmailAndPassword(
  email: string,
  password: string,
): Promise<RegisteredUserWithBans | null> {
  const passwordHash = await hashPassword(password);
  const user = await prisma.registeredUser.findFirst({
    relationLoadStrategy: "join",
    include: {
      user: true,
      bans: {
        where: {
          OR: [{ endTime: null }, { endTime: { gt: new Date() } }],
        },
        orderBy: {
          endTime: "desc",
        },
        take: 1,
      },
    },
    where: { user: { email, passwordHash } },
  });
  return user ?? null;
}

async function getRegisteredUserByEmail(
  email: string,
): Promise<RegisteredUserWithBans | null> {
  // Even though this is a find first, there's only one user with the given
  // email, so it'll be correct
  const user = await prisma.registeredUser.findFirst({
    relationLoadStrategy: "join",
    include: {
      user: true,
      bans: {
        where: {
          OR: [{ endTime: null }, { endTime: { gt: new Date() } }],
        },
        orderBy: {
          endTime: "desc",
        },
        take: 1,
      },
    },
    where: { user: { email } },
  });
  return user ?? null;
}

async function updateUser(
  user: Omit<RegisteredUser, "user">,
): Promise<RegisteredUser> {
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

// async function getActiveUserBans(userId: string, limit: number, offset: number): Promise<Ban[]> {
//   const take = Math.min(10, limit);
//   const skip = Math.max(0, offset) * take;
//   const bans = await prisma.ban.findMany({
//     where: { userId, OR: [{ endTime: null }, { endTime: { gt: new Date() } }] },
//     orderBy: { endTime: 'desc' },
//     take,
//     skip,
//   });
//   return bans;
// }

async function hashPassword(password: string) {
  const saltRounds = 12; // recomendado entre 10–14
  return bcrypt.hash(password, saltRounds);
}

export {
  banUser,
  createUser,
  getRegisteredUserByEmail,
  getRegisteredUserByEmailAndPassword,
  getUserByEmailAndPassword,
  unbanUser,
  updateUser,
};
