import { PrismaClient, UserRole, ServiceType, ReservationStatus, IncidentStatus } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Starting seed...')

  // Note: Admin user will be created through OAuth login flow
  console.log('👤 Admin user will be created when you first login with frannoriega.92@gmail.com')

  // Create sample users
  console.log('👥 Creating sample users...')
  const users = await Promise.all([
    prisma.user.upsert({
      where: { email: 'maria.gonzalez@example.com' },
      update: {},
      create: {
        email: 'maria.gonzalez@example.com',
        name: 'María',
        lastName: 'González',
        dni: '12345678',
        institution: 'Universidad Nacional',
        reasonToJoin: 'Necesito un espacio tranquilo para trabajar en mi tesis doctoral sobre inteligencia artificial aplicada a la medicina.',
        role: UserRole.USER,
        image: 'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=150'
      }
    }),
    prisma.user.upsert({
      where: { email: 'carlos.rodriguez@example.com' },
      update: {},
      create: {
        email: 'carlos.rodriguez@example.com',
        name: 'Carlos',
        lastName: 'Rodríguez',
        dni: '87654321',
        institution: 'StartupTech',
        reasonToJoin: 'Buscamos un espacio colaborativo para desarrollar nuestro proyecto de fintech. La Nube nos ofrece las instalaciones perfectas.',
        role: UserRole.USER,
        image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150'
      }
    }),
    prisma.user.upsert({
      where: { email: 'ana.martinez@example.com' },
      update: {},
      create: {
        email: 'ana.martinez@example.com',
        name: 'Ana',
        lastName: 'Martínez',
        dni: '11223344',
        institution: 'Freelancer',
        reasonToJoin: 'Como diseñadora freelance, necesito un espacio profesional para reunirme con clientes y trabajar en proyectos creativos.',
        role: UserRole.USER,
        image: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150'
      }
    }),
    prisma.user.upsert({
      where: { email: 'jose.silva@example.com' },
      update: {},
      create: {
        email: 'jose.silva@example.com',
        name: 'José',
        lastName: 'Silva',
        dni: '55667788',
        institution: 'Laboratorio de Investigación',
        reasonToJoin: 'Necesito acceso al laboratorio para realizar experimentos de biotecnología. El equipamiento de La Nube es perfecto para mi investigación.',
        role: UserRole.USER,
        image: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150'
      }
    }),
    prisma.user.upsert({
      where: { email: 'lucia.fernandez@example.com' },
      update: {},
      create: {
        email: 'lucia.fernandez@example.com',
        name: 'Lucía',
        lastName: 'Fernández',
        dni: '99887766',
        institution: 'Comunidad Tech',
        reasonToJoin: 'Organizo eventos de programación y necesito el auditorio para charlas y workshops. La Nube es el lugar ideal para nuestra comunidad.',
        role: UserRole.USER,
        image: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150'
      }
    })
  ])

  console.log('📅 Creating sample reservations...')
  
  // Create reservations for different services
  const reservations = await Promise.all([
    // Coworking reservations
    prisma.reservation.create({
      data: {
        userId: users[0].id, // María
        service: ServiceType.COWORKING,
        startTime: new Date('2024-01-15T09:00:00Z'),
        endTime: new Date('2024-01-15T17:00:00Z'),
        reason: 'Trabajo en tesis doctoral - análisis de datos de IA',
        status: ReservationStatus.APPROVED
      }
    }),
    prisma.reservation.create({
      data: {
        userId: users[1].id, // Carlos
        service: ServiceType.COWORKING,
        startTime: new Date('2024-01-16T10:00:00Z'),
        endTime: new Date('2024-01-16T18:00:00Z'),
        reason: 'Desarrollo de aplicación fintech - reunión de equipo',
        status: ReservationStatus.PENDING
      }
    }),
    prisma.reservation.create({
      data: {
        userId: users[2].id, // Ana
        service: ServiceType.COWORKING,
        startTime: new Date('2024-01-17T08:30:00Z'),
        endTime: new Date('2024-01-17T16:30:00Z'),
        reason: 'Sesión de diseño para cliente - proyecto de branding',
        status: ReservationStatus.APPROVED
      }
    }),

    // Lab reservations
    prisma.reservation.create({
      data: {
        userId: users[3].id, // José
        service: ServiceType.LAB,
        startTime: new Date('2024-01-18T09:00:00Z'),
        endTime: new Date('2024-01-18T15:00:00Z'),
        reason: 'Experimentos de cultivo celular - investigación en biotecnología',
        status: ReservationStatus.APPROVED
      }
    }),
    prisma.reservation.create({
      data: {
        userId: users[0].id, // María
        service: ServiceType.LAB,
        startTime: new Date('2024-01-19T14:00:00Z'),
        endTime: new Date('2024-01-19T18:00:00Z'),
        reason: 'Análisis de muestras para tesis - procesamiento de datos',
        status: ReservationStatus.PENDING
      }
    }),

    // Auditorium reservations
    prisma.reservation.create({
      data: {
        userId: users[4].id, // Lucía
        service: ServiceType.AUDITORIUM,
        startTime: new Date('2024-01-20T18:00:00Z'),
        endTime: new Date('2024-01-20T21:00:00Z'),
        reason: 'Workshop de programación React - comunidad tech local',
        status: ReservationStatus.APPROVED
      }
    }),
    prisma.reservation.create({
      data: {
        userId: users[1].id, // Carlos
        service: ServiceType.AUDITORIUM,
        startTime: new Date('2024-01-21T16:00:00Z'),
        endTime: new Date('2024-01-21T19:00:00Z'),
        reason: 'Presentación de startup - demo de producto fintech',
        status: ReservationStatus.REJECTED
      }
    })
  ])

  console.log('🚪 Creating sample check-ins...')
  
  // Create check-ins (some completed, some active)
  const checkIns = await Promise.all([
    // Completed check-ins
    prisma.checkIn.create({
      data: {
        userId: users[0].id,
        reservationId: reservations[0].id,
        checkInTime: new Date('2024-01-15T09:15:00Z'),
        checkOutTime: new Date('2024-01-15T16:45:00Z')
      }
    }),
    prisma.checkIn.create({
      data: {
        userId: users[2].id,
        reservationId: reservations[2].id,
        checkInTime: new Date('2024-01-17T08:45:00Z'),
        checkOutTime: new Date('2024-01-17T16:20:00Z')
      }
    }),
    prisma.checkIn.create({
      data: {
        userId: users[3].id,
        reservationId: reservations[3].id,
        checkInTime: new Date('2024-01-18T09:10:00Z'),
        checkOutTime: new Date('2024-01-18T14:50:00Z')
      }
    }),

    // Active check-ins (no check-out time)
    prisma.checkIn.create({
      data: {
        userId: users[0].id,
        reservationId: reservations[0].id,
        checkInTime: new Date(Date.now() - 2 * 60 * 60 * 1000) // 2 hours ago
      }
    }),
    prisma.checkIn.create({
      data: {
        userId: users[2].id,
        reservationId: reservations[2].id,
        checkInTime: new Date(Date.now() - 30 * 60 * 1000) // 30 minutes ago
      }
    })
  ])

  console.log('⚠️ Creating sample incidents...')
  
  // Create incidents
  const incidents = await Promise.all([
    prisma.incident.create({
      data: {
        subject: 'Problema con el aire acondicionado',
        description: 'El aire acondicionado en la zona de coworking no está funcionando correctamente. La temperatura es muy alta y está afectando el trabajo de los usuarios.',
        status: IncidentStatus.OPEN
      }
    }),
    prisma.incident.create({
      data: {
        subject: 'Equipo de laboratorio descompuesto',
        description: 'El microscopio en el laboratorio presenta problemas de enfoque. Se necesita revisión técnica urgente.',
        status: IncidentStatus.RESOLVED,
        resolvedAt: new Date('2024-01-10T15:30:00Z')
      }
    }),
    prisma.incident.create({
      data: {
        subject: 'Ruido excesivo en auditorio',
        description: 'Usuarios reportan que el sistema de audio del auditorio genera eco y distorsión durante las presentaciones.',
        status: IncidentStatus.CLOSED,
        resolvedAt: new Date('2024-01-08T12:00:00Z')
      }
    })
  ])

  console.log('🔗 Creating incident-user relationships...')
  
  // Create incident-user relationships (users present during incidents)
  await Promise.all([
    // Incident 1 - AC problem (users 0, 2 were present)
    prisma.incidentUser.create({
      data: {
        incidentId: incidents[0].id,
        userId: users[0].id,
        checkInId: checkIns[0].id
      }
    }),
    prisma.incidentUser.create({
      data: {
        incidentId: incidents[0].id,
        userId: users[2].id,
        checkInId: checkIns[1].id
      }
    }),

    // Incident 2 - Lab equipment (user 3 was present)
    prisma.incidentUser.create({
      data: {
        incidentId: incidents[1].id,
        userId: users[3].id,
        checkInId: checkIns[2].id
      }
    }),

    // Incident 3 - Audio issue (users 4, 1 were present)
    prisma.incidentUser.create({
      data: {
        incidentId: incidents[2].id,
        userId: users[4].id,
        checkInId: null // No specific check-in for this incident
      }
    }),
    prisma.incidentUser.create({
      data: {
        incidentId: incidents[2].id,
        userId: users[1].id,
        checkInId: null
      }
    })
  ])

  console.log('✅ Seed completed successfully!')
  console.log(`👥 Created ${users.length} sample users`)
  console.log(`📅 Created ${reservations.length} sample reservations`)
  console.log(`🚪 Created ${checkIns.length} sample check-ins`)
  console.log(`⚠️ Created ${incidents.length} sample incidents`)
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
