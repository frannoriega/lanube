/** User profile helpers */
import { now, nowMs } from "@/lib/clock";
import { DomainError } from "@/lib/errors";
import { normalizeEmailForIdentityServer } from "@/lib/email/identity-server";
import { prisma } from "@/lib/prisma";
import { Ban, Prisma, RegisteredUser, User } from "@/generated/prisma/client";
import { dateToUnixMs } from "@/lib/unix-ms";
import bcrypt from "bcryptjs";
import { startOfMonth } from "date-fns";

type RegisteredUserListRow = RegisteredUser & {
  roleRef: { id: string; name: string } | null;
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
    /** Display name of the assigned role, or null on the base tier. */
    role: string | null;
    roleId: string | null;
    createdAt: number;
    updatedAt: number;
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

/**
 * RBAC role assignment (needs `users:roles:manage`; guarded at the API layer).
 * `roleId` is null for the base tier. The FK is Restrict-on-delete, so passing an id that
 * no longer exists surfaces as a Prisma error rather than silently clearing the role.
 */
export async function updateUserRole(
  id: string,
  roleId: string | null,
): Promise<RegisteredUser & { roleRef: { id: string; name: string } | null }> {
  return prisma.registeredUser.update({
    where: { id },
    data: { roleId },
    include: { roleRef: { select: { id: true, name: true } } },
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
        roleRef: {
          select: { id: true, name: true },
        },
        bans: {
          where: {
            OR: [{ endTime: null }, { endTime: { gt: BigInt(nowMs()) } }],
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

        // "role" is no longer a column on this table — sort by the joined role's name.
        // Base-tier rows (roleId null) sort last regardless of direction in Postgres'
        // default NULLS LAST for ASC; acceptable, and the UI labels them "Sin rol".
        if (orderField === "role") {
          return [
            {
              roleRef: { name: direction },
            } as Prisma.RegisteredUserOrderByWithRelationInput,
            { createdAt: direction },
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

  const atMs = nowMs();
  const payload: GetUsersResult["users"] = rows.map(
    (user: RegisteredUserListRow) => {
      const activeBan = user.bans[0] ?? null;
      const isBanned =
        !!activeBan && (!activeBan.endTime || Number(activeBan.endTime) > atMs);

      return {
        id: user.id,
        name: user.name,
        lastName: user.lastName,
        dni: user.dni,
        institution: user.institution ?? null,
        role: user.roleRef?.name ?? null,
        roleId: user.roleId,
        createdAt: Number(user.createdAt),
        updatedAt: Number(user.updatedAt),
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
  const at = now();
  const monthStart = startOfMonth(at);

  const [totalUsers, bannedUsers, monthUsers] = await Promise.all([
    prisma.registeredUser.count(),
    prisma.registeredUser.count({
      where: {
        bans: {
          some: {
            OR: [{ endTime: null }, { endTime: { gt: dateToUnixMs(at) } }],
          },
        },
      },
    }),
    prisma.registeredUser.count({
      where: {
        createdAt: {
          gte: dateToUnixMs(monthStart),
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

/**
 * Actualiza los datos personales **editables** del propio usuario: nombre, apellido e
 * institución.
 *
 * El DNI y el motivo para unirse quedaron fuera a propósito (milestone 17): no se editan
 * directo ni por el usuario ni por un admin, solo a través de una solicitud aprobada
 * (`src/lib/db/profileChangeRequests.ts`). Por eso esta función ni siquiera los acepta —
 * así ninguna ruta nueva puede volver a escribirlos por accidente pasándolos acá.
 */
export async function updateOwnPersonalInfo(
  registeredUserId: string,
  data: {
    name: string;
    lastName: string;
    institution: string | null;
  },
) {
  const updated = await prisma.registeredUser
    .update({
      where: { id: registeredUserId },
      data: {
        name: data.name,
        lastName: data.lastName,
        institution: data.institution,
      },
      include: {
        user: { select: { email: true, displayEmail: true } },
        roleRef: { select: { id: true, name: true } },
      },
    })
    .catch((err: unknown) => {
      // P2025: la fila no existe (cuenta borrada con un JWT todavía vivo).
      if ((err as { code?: string }).code === "P2025") {
        throw new DomainError("Usuario no encontrado", 404);
      }
      throw err;
    });

  return {
    id: updated.id,
    name: updated.name,
    lastName: updated.lastName,
    email: updated.user.email,
    displayEmail: updated.user.displayEmail,
    dni: updated.dni,
    institution: updated.institution ?? null,
    reasonToJoin: updated.reasonToJoin,
    role: updated.roleRef?.name ?? null,
    createdAt: updated.createdAt,
    updatedAt: updated.updatedAt,
  };
}

interface RegisteredUserWithBans extends RegisteredUser {
  user: User;
  bans: Ban[];
}

/**
 * Crea la cuenta (`User`). `db` permite hacerlo dentro de una transacción: el registro crea la
 * cuenta y sus aceptaciones de políticas juntas (milestone 19), así nunca queda una cuenta sin
 * su consentimiento.
 */
async function createUser(
  email: string,
  password: string,
  displayEmail: string,
  db: Pick<typeof prisma, "user"> = prisma,
): Promise<User> {
  const canonical = await normalizeEmailForIdentityServer(email);
  const passwordHash = await hashPassword(password);
  const user = await db.user.create({
    data: {
      email: canonical,
      displayEmail,
      passwordHash,
    },
  });
  return user;
}

async function getUserByEmailAndPassword(
  email: string,
  password: string,
): Promise<User | null> {
  email = await normalizeEmailForIdentityServer(email);
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

async function getRegisteredUserByEmail(
  email: string,
): Promise<RegisteredUserWithBans | null> {
  email = await normalizeEmailForIdentityServer(email);
  // Even though this is a find first, there's only one user with the given
  // email, so it'll be correct
  const user = await prisma.registeredUser.findFirst({
    relationLoadStrategy: "join",
    include: {
      user: true,
      bans: {
        where: {
          OR: [{ endTime: null }, { endTime: { gt: BigInt(nowMs()) } }],
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

export async function markUserEmailVerified(email: string): Promise<boolean> {
  email = await normalizeEmailForIdentityServer(email);
  const result = await prisma.user.updateMany({
    where: { email },
    data: { emailVerified: BigInt(nowMs()) },
  });
  return result.count > 0;
}

export {
  banUser,
  createUser,
  hashPassword,
  getRegisteredUserByEmail,
  getUserByEmailAndPassword,
  unbanUser,
  updateUser,
};
