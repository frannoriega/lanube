import { PrismaClient, ResourceType } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
   // Fill in later
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
