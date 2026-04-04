import { PrismaClient, ResourceType, UserRole } from "@/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter })

/**
 * Dev-only accounts: same shape the app expects from register → email confirm → signup profile.
 *
 * - `User`: login (email, passwordHash). Must match `hashPassword` in src/lib/db/users.ts (bcryptjs, 12 rounds).
 * - `emailVerified`: required for credentials sign-in (see NextAuth authorize).
 * - `RegisteredUser`: profile row linked by `userId` (created in /api/auth/signup in production).
 *
 * To add more users: duplicate the object in EXAMPLE_USERS, use unique `email` + `dni`, and pick `role`:
 * `UserRole.USER` | `UserRole.ADMIN`.
 */
const BCRYPT_ROUNDS = 12

function generateUsers(): Array<{
  email: string
  password: string
  name: string
  lastName: string
  dni: string
  institution: string | null
  reasonToJoin: string
  role: UserRole
}> {
  let users: Array<{
    email: string
    password: string
    name: string
    lastName: string
    dni: string
    institution: string | null
    reasonToJoin: string
    role: UserRole
  }> = [];

  for (let i = 1; i <= 30; i++) {
    users.push({
      email: `u${i}@lanube.local`,
      password: "123123123",
      name: `Usuario ${i}`,
      lastName: "Ejemplo",
      dni: `2000000${i}`,
      institution: "La Nube (desarrollo)",
      reasonToJoin: "Usuario de ejemplo generado por prisma/seed.ts",
      role: UserRole.USER,
    });
  }

  for (let i = 1; i <= 10; i++) {
    users.push({
      email: `a${i}@lanube.local`,
      password: "123123123",
      name: `Admin ${i}`,
      lastName: "Ejemplo",
      dni: `3000000${i}`,
      institution: "La Nube (desarrollo)",
      reasonToJoin: "Usuario de ejemplo generado por prisma/seed.ts",
      role: UserRole.ADMIN,
    });
  }

  return users;
}

async function seedExampleUsers() {
  const users = generateUsers();
  for (const u of users) {
    const passwordHash = await bcrypt.hash(u.password, BCRYPT_ROUNDS)

    const user = await prisma.user.upsert({
      where: { email: u.email },
      create: {
        email: u.email,
        passwordHash,
        emailVerified: BigInt(Date.now()),
        name: `${u.name} ${u.lastName}`,
      },
      update: {
        passwordHash,
        emailVerified: BigInt(Date.now()),
        name: `${u.name} ${u.lastName}`,
      }
    })

    await prisma.registeredUser.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        name: u.name,
        lastName: u.lastName,
        dni: u.dni,
        institution: u.institution,
        reasonToJoin: u.reasonToJoin,
        role: u.role,
      },
      update: {
        name: u.name,
        lastName: u.lastName,
        dni: u.dni,
        institution: u.institution,
        reasonToJoin: u.reasonToJoin,
        role: u.role,
      },
    })

    console.log(`[seed] User ready: ${u.email} (password: ${u.password}) role=${u.role}`)
  }
}

async function main() {
  const meetingRoomResource = await prisma.fungibleResource.create({
    data: {
      name: "Sala de reuniones",
      capacity: 6,
      isExclusive: true,
    },
  })

  const laboratoryResource = await prisma.fungibleResource.create({
    data: {
      name: "Laboratorio",
      capacity: 8,
      isExclusive: true,
    },
  })

  const auditoriumResource = await prisma.fungibleResource.create({
    data: {
      name: "Auditorio",
      capacity: 40,
    },
  })

  const coworkingResource = await prisma.fungibleResource.create({
    data: {
      name: "Coworking",
      capacity: 12,
    },
  })

  const resources = await prisma.resource.createMany({
    data: [
      {
        name: "Sala de reuniones",
        type: ResourceType.MEETING,
        fungibleResourceId: meetingRoomResource.id,
      },
      {
        name: "Laboratorio",
        type: ResourceType.LAB,
        fungibleResourceId: laboratoryResource.id,
      },
      {
        name: "Auditorio",
        type: ResourceType.AUDITORIUM,
        fungibleResourceId: auditoriumResource.id,
      },
      {
        name: "Coworking",
        type: ResourceType.COWORKING,
        fungibleResourceId: coworkingResource.id,
      },
    ],
  })

  await seedExampleUsers()
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
