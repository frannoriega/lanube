import {
  PrismaClient,
  ReservableType,
  ReservationStatus,
  UserRole,
} from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const BCRYPT_ROUNDS = 12;

// Base reservation-type codes (seeded into reservation_types by the
// 20260706110000_reservation_types_table migration).
const EventType = {
  MEETING: "MEETING",
  WORKSHOP: "WORKSHOP",
  CONFERENCE: "CONFERENCE",
  OTHER: "OTHER",
} as const;
type EventType = (typeof EventType)[keyof typeof EventType];

// ── Seeded PRNG (Mulberry32) ──────────────────────────────────────────────────
// Fixed seed ensures the same reservations are generated every time the seed
// runs, regardless of when Date.now() actually is.
class Rng {
  private s: number;
  constructor(seed = 42) {
    this.s = seed >>> 0;
  }
  next(): number {
    this.s = (this.s + 0x6d2b79f5) | 0;
    let t = Math.imul(this.s ^ (this.s >>> 15), 1 | this.s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) | 0;
    return ((t ^ (t >>> 14)) >>> 0) / 2 ** 32;
  }
  int(lo: number, hi: number): number {
    return lo + Math.floor(this.next() * (hi - lo + 1));
  }
  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }
}

// ── Users ─────────────────────────────────────────────────────────────────────

function generateUsers(): Array<{
  email: string;
  password: string;
  name: string;
  lastName: string;
  dni: string;
  institution: string | null;
  reasonToJoin: string;
  role: UserRole;
}> {
  const users: Array<{
    email: string;
    password: string;
    name: string;
    lastName: string;
    dni: string;
    institution: string | null;
    reasonToJoin: string;
    role: UserRole;
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

  for (let i = 1; i <= 2; i++) {
    users.push({
      email: `sa${i}@lanube.local`,
      password: "123123123",
      name: `Superadmin ${i}`,
      lastName: "Ejemplo",
      dni: `4000000${i}`,
      institution: "La Nube (desarrollo)",
      reasonToJoin: "Usuario de ejemplo generado por prisma/seed.ts",
      role: UserRole.SUPERADMIN,
    });
  }

  return users;
}

async function seedExampleUsers() {
  const users = generateUsers();
  for (const u of users) {
    const passwordHash = await bcrypt.hash(u.password, BCRYPT_ROUNDS);

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
    });

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
    });

    console.log(
      `[seed] User ready: ${u.email} (password: ${u.password}) role=${u.role}`,
    );
  }
}

// ── Time slots ────────────────────────────────────────────────────────────────
// 22 pairs [startHour, endHour] spanning 1 h – 8 h.
// Variety is intentional: reports show min/avg/max duration, so having a wide
// spread (60 min to 480 min) makes those stats meaningful.
const SLOT_PAIRS: readonly [number, number][] = [
  [9, 10], // 1 h
  [10, 11], // 1 h
  [11, 12], // 1 h
  [14, 15], // 1 h
  [15, 16], // 1 h
  [16, 17], // 1 h
  [9, 11], // 2 h
  [10, 12], // 2 h
  [11, 13], // 2 h
  [13, 15], // 2 h
  [14, 16], // 2 h
  [15, 17], // 2 h
  [9, 12], // 3 h
  [10, 13], // 3 h
  [13, 16], // 3 h
  [14, 17], // 3 h
  [9, 13], // 4 h
  [10, 14], // 4 h
  [13, 17], // 4 h
  [9, 14], // 5 h
  [10, 16], // 6 h
  [9, 17], // 8 h
];

// ── Content pools ─────────────────────────────────────────────────────────────
const REASONS: Record<EventType, readonly string[]> = {
  [EventType.MEETING]: [
    "[seed] Reunión semanal de equipo",
    "[seed] Revisión de proyecto",
    "[seed] Planificación de sprint",
    "[seed] Entrevista a candidato",
    "[seed] Junta directiva",
    "[seed] Retrospectiva de equipo",
    "[seed] Reunión con cliente",
    "[seed] Coordinación de área",
  ],
  [EventType.WORKSHOP]: [
    "[seed] Taller de programación",
    "[seed] Curso de Arduino",
    "[seed] Taller de impresión 3D",
    "[seed] Sesión de prototipado",
    "[seed] Práctica de electrónica",
    "[seed] Taller de diseño UX",
    "[seed] Capacitación técnica",
    "[seed] Hackathon interna",
  ],
  [EventType.CONFERENCE]: [
    "[seed] Conferencia de innovación",
    "[seed] Demo day de startups",
    "[seed] Presentación de proyecto",
    "[seed] Charla de networking",
    "[seed] Presentación anual",
    "[seed] Conferencia de tecnología",
    "[seed] Simposio de investigación",
  ],
  [EventType.OTHER]: [
    "[seed] Evento comunitario",
    "[seed] Jornada cultural",
    "[seed] Asamblea de socios",
    "[seed] Evento de bienvenida",
    "[seed] Actividad de integración",
    "[seed] Exposición fotográfica",
  ],
};

const DENIED_REASONS: readonly string[] = [
  "[seed] Turno no disponible en ese horario",
  "[seed] Recurso en mantenimiento programado",
  "[seed] Franja horaria ya asignada",
  "[seed] Cupo máximo alcanzado para ese horario",
  "[seed] Solicitud fuera del horario de funcionamiento",
];

// ── Status logic ──────────────────────────────────────────────────────────────
// Always consumes exactly one RNG value so the sequence stays deterministic
// regardless of which branch is taken.
//
// Probabilities are set so that ALL days (including today and future) produce
// enough APPROVED reservations to be visible in the admin reports, which filter
// for status = APPROVED.
//
//  day <  0 → 80 % APPROVED / 20 % REJECTED  (settled history)
//  day =  0 → 70 % APPROVED / 30 % PENDING   (today — mostly confirmed)
//  day <= 14 → 50 % APPROVED / 50 % PENDING  (near future — half pre-approved)
//  day >  14 → 15 % APPROVED / 85 % PENDING  (far future — mostly pending)
function pickStatus(day: number, rng: Rng): ReservationStatus {
  const r = rng.next();
  if (day < 0)
    return r < 0.8 ? ReservationStatus.APPROVED : ReservationStatus.REJECTED;
  if (day === 0)
    return r < 0.7 ? ReservationStatus.APPROVED : ReservationStatus.PENDING;
  if (day <= 14)
    return r < 0.5 ? ReservationStatus.APPROVED : ReservationStatus.PENDING;
  return r < 0.15 ? ReservationStatus.APPROVED : ReservationStatus.PENDING;
}

// ── Reservation seeding ───────────────────────────────────────────────────────

interface ReservationRow {
  reservableType: ReservableType;
  reservableId: string;
  spaceId: string;
  eventType: EventType;
  reason: string;
  status: ReservationStatus;
  startTime: bigint;
  endTime: bigint;
  deniedReason?: string;
}

async function seedReservations(
  resourceIds: {
    meeting: string;
    lab: string;
    auditorium: string;
    coworking: string;
  },
  userIds: string[],
) {
  // Clear previous seed reservations (idempotent re-runs)
  await prisma.reservation.deleteMany({
    where: { reason: { startsWith: "[seed]" } },
  });

  const rng = new Rng(42);
  const rows: ReservationRow[] = [];

  // Midnight in Argentina timezone (UTC-3), so slot hours (9, 10, 14…) map to
  // Argentina business hours regardless of server TZ (e.g. UTC in Docker).
  // Argentina is UTC-3: subtract 3 h to convert to Argentina wall time, zero
  // the UTC clock at that point (= midnight Argentina), then add 3 h back to
  // get the UTC ms for midnight Argentina.
  const ARGENTINA_OFFSET_MS = 3 * 3_600_000;
  const nowInArgentina = new Date(Date.now() - ARGENTINA_OFFSET_MS);
  nowInArgentina.setUTCHours(0, 0, 0, 0);
  const todayMs = nowInArgentina.getTime() + ARGENTINA_OFFSET_MS;

  // makeRow always consumes the same number of RNG values (6) so the sequence
  // is fully deterministic regardless of the resource or day.
  const makeRow = (
    dayMs: number,
    day: number,
    spaceId: string,
    eventTypes: readonly EventType[],
  ): ReservationRow => {
    const [s, e] = rng.pick(SLOT_PAIRS);
    const userId = rng.pick(userIds);
    const status = pickStatus(day, rng);
    const denied = rng.pick(DENIED_REASONS);
    const eventType = rng.pick(eventTypes);
    const reason = rng.pick(REASONS[eventType]);
    return {
      reservableType: ReservableType.USER,
      reservableId: userId,
      spaceId,
      startTime: BigInt(dayMs + s * 3_600_000),
      endTime: BigInt(dayMs + e * 3_600_000),
      status,
      eventType,
      reason,
      deniedReason: status === ReservationStatus.REJECTED ? denied : undefined,
    };
  };

  // ── Daily loop: day −30 → +30 ─────────────────────────────────────────────
  // Per day:
  //   • Meeting room (exclusive):   always 1   → total 4-8/day with others
  //   • Lab          (exclusive):   always 1
  //   • Auditorium   (cap 40):      1-3
  //   • Coworking    (cap 12):      1-3
  //
  // Expected: 4-8 reservations/day, well within the 2-10 target.
  // No two APPROVED for the same exclusive resource on the same day because
  // each exclusive resource produces at most 1 row per day.
  for (let day = -30; day <= 30; day++) {
    const dayMs = todayMs + day * 86_400_000;

    rows.push(makeRow(dayMs, day, resourceIds.meeting, [EventType.MEETING]));

    rows.push(
      makeRow(dayMs, day, resourceIds.lab, [
        EventType.WORKSHOP,
        EventType.OTHER,
      ]),
    );

    const nAudit = rng.int(1, 3);
    for (let j = 0; j < nAudit; j++) {
      rows.push(
        makeRow(dayMs, day, resourceIds.auditorium, [
          EventType.CONFERENCE,
          EventType.WORKSHOP,
          EventType.OTHER,
        ]),
      );
    }

    const nCow = rng.int(1, 3);
    for (let j = 0; j < nCow; j++) {
      rows.push(
        makeRow(dayMs, day, resourceIds.coworking, [
          EventType.MEETING,
          EventType.WORKSHOP,
        ]),
      );
    }
  }

  // ── Special: pending over exclusive capacity ──────────────────────────────
  // Day +5, 10:00-12:00: 3 PENDING for meeting room at the same slot.
  // Only 1 can ever be approved (exclusive), so this shows an over-capacity
  // conflict queue for admins to resolve.
  {
    const ms = todayMs + 5 * 86_400_000 + 10 * 3_600_000;
    for (let i = 0; i < 3; i++) {
      rows.push({
        reservableType: ReservableType.USER,
        reservableId: userIds[i % userIds.length],
        spaceId: resourceIds.meeting,
        startTime: BigInt(ms),
        endTime: BigInt(ms + 2 * 3_600_000),
        status: ReservationStatus.PENDING,
        eventType: EventType.MEETING,
        reason: `[seed] Solicitud de sala – turno concurrido (${i + 1}/3)`,
      });
    }
  }

  // Day +8, 14:00-17:00: 4 PENDING for lab at the same slot.
  {
    const ms = todayMs + 8 * 86_400_000 + 14 * 3_600_000;
    for (let i = 0; i < 4; i++) {
      rows.push({
        reservableType: ReservableType.USER,
        reservableId: userIds[(i + 3) % userIds.length],
        spaceId: resourceIds.lab,
        startTime: BigInt(ms),
        endTime: BigInt(ms + 3 * 3_600_000),
        status: ReservationStatus.PENDING,
        eventType: EventType.WORKSHOP,
        reason: `[seed] Solicitud de laboratorio – turno concurrido (${i + 1}/4)`,
      });
    }
  }

  // ── Special: pending over non-exclusive capacity ──────────────────────────
  // Day +12, 10:00-13:00: 15 PENDING for coworking (capacity = 12).
  // Demonstrates the over-capacity conflict queue for non-exclusive resources.
  {
    const ms = todayMs + 12 * 86_400_000 + 10 * 3_600_000;
    for (let i = 0; i < 15; i++) {
      rows.push({
        reservableType: ReservableType.USER,
        reservableId: userIds[i % userIds.length],
        spaceId: resourceIds.coworking,
        startTime: BigInt(ms),
        endTime: BigInt(ms + 3 * 3_600_000),
        status: ReservationStatus.PENDING,
        eventType: EventType.MEETING,
        reason: `[seed] Solicitud de coworking – turno superpoblado (${i + 1}/15)`,
      });
    }
  }

  await prisma.reservation.createMany({ data: rows });
  console.log(`[seed] ${rows.length} reservations created across 61 days`);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  // ── Spaces ────────────────────────────────────────────────────────────────────
  await prisma.space.upsert({
    where: { slug: "coworking" },
    create: {
      name: "Coworking",
      slug: "coworking",
      description:
        "Espacio flexible para trabajo individual y colaborativo.\n\n Ideal para programar, diseñar, investigar, atender reuniones breves y avanzar proyectos tecnológicos.",
      longDescription:
        "El espacio de coworking está pensado para que personas y equipos puedan trabajar, estudiar o desarrollar proyectos en un entorno colaborativo orientado a la tecnología.\n\nEs ideal para emprendedores, estudiantes, profesionales independientes y equipos de trabajo que necesitan un lugar tranquilo, cómodo y conectado para sus actividades diarias.",
      faqs: [
        {
          question: "¿Qué ofrecemos?",
          answer:
            "- **Puestos de trabajo flexibles** por hora, por día o por proyecto\n- **Conectividad a Internet**\n- **Acompañamiento y orientación básica** en el uso de herramientas tecnológicas",
        },
        {
          question: "¿Qué equipos tenemos disponibles?",
          answer:
            "- **3 islas de trabajo** con 4 espacios por mesa, haciendo un total de **12 puestos de trabajo**.\n- **3 livings completos**, cada uno con mesa, sillones y pufs, ideales para reuniones informales o trabajo más distendido.\n- **Proyector y pantalla de alta definición**, que permiten realizar presentaciones, encuentros virtuales o instancias de capacitación.\n- **Conectividad Wi-Fi** de alta velocidad y **tomas eléctricas** para la conexión de notebooks y otros dispositivos.",
        },
      ],
      imageUrl: "/images/services/coworking.jpg",
      iconName: "Building2",
      isReservable: true,
      isFeatured: false,
      displayOrder: 0,
      capacity: 12,
      isExclusive: false,
      metadata: [],
    },
    update: {},
  });

  await prisma.space.upsert({
    where: { slug: "lab" },
    create: {
      name: "Laboratorio",
      slug: "lab",
      description:
        "Ámbito técnico para talleres.\n\n Pensado para hackathones, workshops prácticos y sesiones de trabajo en equipo.",
      longDescription:
        "El laboratorio es un espacio destinado principalmente a **reuniones de trabajo y actividades en equipo**, pensado como ámbito de apoyo para proyectos, planificación y trabajos colaborativos.",
      faqs: [
        {
          question: "¿Qué ofrecemos?",
          answer:
            "- Reuniones de trabajo en equipo y espacios de coordinación\n- Desarrollo de actividades de planificación, diseño de proyectos y trabajo colaborativo\n- Uso como ámbito de apoyo para grupos que requieren un entorno tranquilo y con conectividad",
        },
        {
          question: "¿Qué equipos tenemos disponibles?",
          answer:
            "- **Una mesa de trabajo** con capacidad para **8 a 10 personas**.\n- **Tomas corrientes** distribuidas para la conexión de notebooks y dispositivos electrónicos.\n- **Acceso a Wi-Fi**, que permite el trabajo conectado y el uso de herramientas digitales en línea.\n\nNo cuenta con otro tipo de equipamiento específico, lo que lo convierte en un espacio flexible que puede adaptarse a distintas dinámicas de trabajo grupal.",
        },
      ],
      imageUrl: "/images/services/laboratorio.jpg",
      iconName: "FlaskConical",
      isReservable: true,
      isFeatured: false,
      displayOrder: 1,
      capacity: 8,
      isExclusive: true,
      metadata: [],
    },
    update: {},
  });

  await prisma.space.upsert({
    where: { slug: "meeting-room" },
    create: {
      name: "Sala de reuniones",
      slug: "meeting-room",
      description:
        "Ámbito reservado para reuniones privadas.\n\n Pensada para planificaciones, presentaciones a equipos y entrevistas.",
      longDescription:
        "La sala de reuniones está diseñada para encuentros de trabajo en grupos reducidos, tutorías, entrevistas, mesas de planificación y reuniones institucionales, tanto presenciales como virtuales o híbridas orientadas a la tecnología.",
      faqs: [
        {
          question: "¿Qué ofrecemos?",
          answer:
            "- Realización de reuniones presenciales, virtuales e híbridas con alta calidad de audio y video\n- Presentaciones interactivas sobre la pantalla táctil (anotaciones, gráficos, esquemas, etc.)\n- Espacio confortable y reservado para trabajos que requieren concentración, toma de decisiones y confidencialidad",
        },
        {
          question: "¿Qué equipos tenemos disponibles?",
          answer:
            "### Pantalla táctil interactiva\n- **Resolución:** 3840 x 2160 píxeles (UHD)\n- **Tecnología táctil:** multitáctil\n- **Conectividad física:** 1 puerto DisplayPort, 4 puertos HDMI, 1 puerto VGA (D-Sub)\n- **Conectividad inalámbrica:** Bluetooth 5.0 y Wi-Fi\n- **Software:** herramientas para gráficos, anotaciones y exposiciones en reuniones\n\n### Sistema de videoconferencia Poly Studio R30\n- **Altavoz integrado omnidireccional**, para escuchar con claridad a todos los participantes.\n- **Cámara de alta calidad** con campo de visión de **120°** y tecnología **Poly DirectorAI**.\n- **Matriz de 3 micrófonos** con tecnologías de audio que bloquean ruidos.\n\n### Isla de trabajo\n- **Mesa central** con capacidad para 6 a 8 personas.",
        },
      ],
      imageUrl: "/images/services/sala-de-reuniones.jpg",
      iconName: "MessagesSquare",
      isReservable: true,
      isFeatured: false,
      displayOrder: 2,
      capacity: 6,
      isExclusive: true,
      metadata: [{ type: "stat", value: "Pizarra digital", icon: "Monitor" }],
    },
    update: {},
  });

  await prisma.space.upsert({
    where: { slug: "auditorium" },
    create: {
      name: "Auditorio",
      slug: "auditorium",
      description:
        "Ambiente amplio y modular para charlas, talleres y presentaciones.\n\n Apto para actividades académicas, empresariales y comunitarias.",
      longDescription:
        "La sala de conferencias está pensada para actividades orientadas a la tecnología con mayor cantidad de asistentes: charlas, presentaciones, paneles, jornadas, capacitaciones y eventos institucionales.",
      faqs: [
        {
          question: "¿Qué ofrecemos?",
          answer:
            "- Realización de conferencias, charlas, paneles, jornadas y capacitaciones\n- Eventos presenciales e híbridos con soporte de audio, video y proyección\n- Uso del equipamiento para presentaciones multimedia y transmisión de contenidos",
        },
        {
          question: "¿Qué equipos tenemos disponibles?",
          answer:
            "- **Capacidad para aproximadamente 50 personas**, con disposición adaptable según el tipo de actividad (filas, aula, trabajo en grupos, etc.).\n- **Pantalla gigante para charlas y conferencias**, integrada al sistema de sonido del espacio.\n- **Sistema de sonido integrado**, adecuado para presentaciones orales, proyecciones y actividades formativas.\n- **Cámara Logitech para conferencias**, que permite transmisiones, videoconferencias y actividades híbridas.\n- Posibilidad de conexión **USB y HDMI** al sistema de pantalla y sonido.",
        },
      ],
      imageUrl: "/images/services/auditorio.jpg",
      iconName: "Presentation",
      isReservable: true,
      isFeatured: false,
      displayOrder: 3,
      capacity: 40,
      isExclusive: false,
      metadata: [
        { type: "stat", value: "Proyección", icon: "Presentation" },
        { type: "stat", value: "Sonido", icon: "Speaker" },
        { type: "stat", value: "Streaming", icon: "Radio" },
      ],
    },
    update: {},
  });

  const [meetingRoom, laboratory, auditorium, coworking] = await Promise.all([
    prisma.space.findUniqueOrThrow({
      where: { slug: "meeting-room" },
      select: { id: true },
    }),
    prisma.space.findUniqueOrThrow({
      where: { slug: "lab" },
      select: { id: true },
    }),
    prisma.space.findUniqueOrThrow({
      where: { slug: "auditorium" },
      select: { id: true },
    }),
    prisma.space.findUniqueOrThrow({
      where: { slug: "coworking" },
      select: { id: true },
    }),
  ]);

  console.log("[seed] Spaces ready");

  await seedExampleUsers();

  // Build a stable ordered list of RegisteredUser IDs (u1 … u30), sorted
  // numerically so rng.pick(userIds) returns the same user for a given RNG
  // value regardless of insertion order in the DB.
  const seedUsers = await prisma.user.findMany({
    where: { email: { endsWith: "@lanube.local" } },
    select: { email: true, registeredUser: { select: { id: true } } },
  });

  const userIds = seedUsers
    .filter((u) => /^u\d+@lanube\.local$/.test(u.email) && u.registeredUser?.id)
    .sort((a, b) => {
      const nA = parseInt(a.email.match(/\d+/)![0]);
      const nB = parseInt(b.email.match(/\d+/)![0]);
      return nA - nB;
    })
    .map((u) => u.registeredUser!.id);

  await seedReservations(
    {
      meeting: meetingRoom.id,
      lab: laboratory.id,
      auditorium: auditorium.id,
      coworking: coworking.id,
    },
    userIds,
  );
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
