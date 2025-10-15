import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
   // Fill in later
   const meetingRoomResource = await prisma.fungibleResource.create({
    data: {
      name: "Sala de reuniones",
      type: "MEETING",
      capacity: -1,
    },
   })

   const laboratoryResource = await prisma.fungibleResource.create({
    data: {
      name: "Laboratorio",
      type: "LAB",
      capacity: -1,
    },
   })

   const auditoriumResource = await prisma.fungibleResource.create({
    data: {
      name: "Auditorio",
      type: "AUDITORIUM",
      capacity: -1,
    },
   })

   const coworkingResource = await prisma.fungibleResource.create({
    data: {
      name: "Coworking",
      type: "COWORKING",
      capacity: 40,
    },
   })

   const resources = await prisma.resource.createMany({
    data: [
      {
        name: "Sala de reuniones",
        fungibleResourceId: meetingRoomResource.id,
      },
      {
        name: "Laboratorio",
        fungibleResourceId: laboratoryResource.id,
      },
      {
        name: "Auditorio",
        fungibleResourceId: auditoriumResource.id,
      },
      {
        name: "Coworking",
        fungibleResourceId: coworkingResource.id,
      },
    ],
   })
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    await prisma.$disconnect()
    process.exit(1)
  })
