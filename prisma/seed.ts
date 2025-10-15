import { PrismaClient, ResourceType } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
   // Fill in later
   const meetingRoomResource = await prisma.fungibleResource.create({
    data: {
      name: "Sala de reuniones",
      type: ResourceType.MEETING,
      capacity: 6,
      isExclusive: true,
    },
   })

   const laboratoryResource = await prisma.fungibleResource.create({
    data: {
      name: "Laboratorio",
      type: ResourceType.LAB,
      capacity: 8,
      isExclusive: true,
    },
   })

   const auditoriumResource = await prisma.fungibleResource.create({
    data: {
      name: "Auditorio",
      type: ResourceType.AUDITORIUM,
      capacity: 40,
    },
   })

   const coworkingResource = await prisma.fungibleResource.create({
    data: {
      name: "Coworking",
      type: ResourceType.COWORKING,
      capacity: 12,
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
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
