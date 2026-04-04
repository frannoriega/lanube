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

const EXAMPLE_USERS: Array<{
  email: string
  /** Plaintext dev password — never use in production data. */
  password: string
  name: string
  lastName: string
  dni: string
  institution: string | null
  reasonToJoin: string
  role: UserRole
}> = [
    {
      email: "u1v@lanube.local",
      password: "123123123",
      name: "Usuario 1",
      lastName: "Ejemplo",
      dni: "20000001",
      institution: "La Nube (desarrollo)",
      reasonToJoin: "Usuario de ejemplo generado por prisma/seed.ts",
      role: UserRole.USER,
    },
    {
      email: "u2@lanube.local",
      password: "123123123",
      name: "Usuario 2",
      lastName: "Ejemplo",
      dni: "20000002",
      institution: "La Nube (desarrollo)",
      reasonToJoin: "Usuario de ejemplo generado por prisma/seed.ts",
      role: UserRole.USER,
    },
    {
      email: "a1@lanube.local",
      password: "123123123",
      name: "Admin 1",
      lastName: "Ejemplo",
      dni: "20000003",
      institution: "La Nube (desarrollo)",
      reasonToJoin: "Usuario de ejemplo generado por prisma/seed.ts",
      role: UserRole.ADMIN,
    },
    {
      email: "a2@lanube.local",
      password: "123123123",
      name: "Admin 2",
      lastName: "Ejemplo",
      dni: "20000004",
      institution: "La Nube (desarrollo)",
      reasonToJoin: "Usuario de ejemplo generado por prisma/seed.ts",
      role: UserRole.ADMIN,
    }
  ]

async function seedExampleUsers() {
  for (const u of EXAMPLE_USERS) {
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
      },
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
