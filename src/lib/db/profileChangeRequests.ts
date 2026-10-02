import "server-only";
import { nowMs } from "@/lib/clock";
import { DomainError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import type {
  ProfileChangeField,
  ProfileChangeStatus,
} from "@/generated/prisma/client";

/**
 * Solicitudes de cambio de los datos protegidos del perfil (milestone 17): DNI y motivo
 * para unirse.
 *
 * El flujo tiene dos actores y ninguno puede escribir el dato solo:
 * - el **usuario** propone un valor nuevo con una justificación (`createProfileChangeRequest`)
 *   y puede retirarla mientras está pendiente (`cancelProfileChangeRequest`);
 * - un **admin** con `users:profile-requests:review` la aprueba o rechaza
 *   (`decideProfileChangeRequest`) — nunca la suya propia, y nunca con un valor distinto al
 *   que pidió el usuario: la decisión es sí/no, no una edición.
 *
 * Así no hay fraude (el usuario no cambia su DNI a voluntad) ni abuso (el admin no le
 * cambia el DNI a nadie sin que la persona lo haya pedido).
 */

/** Columna de `RegisteredUser` que escribe cada campo al aprobarse. */
const FIELD_COLUMN = {
  DNI: "dni",
  REASON_TO_JOIN: "reasonToJoin",
} as const satisfies Record<ProfileChangeField, string>;

/** Lo que ve el propio usuario de cada solicitud (su historial en Configuración). */
export interface OwnProfileChangeRequest {
  id: string;
  field: ProfileChangeField;
  currentValue: string;
  requestedValue: string;
  justification: string;
  status: ProfileChangeStatus;
  decisionReason: string | null;
  decidedAt: bigint | null;
  createdAt: bigint;
}

const OWN_SELECT = {
  id: true,
  field: true,
  currentValue: true,
  requestedValue: true,
  justification: true,
  status: true,
  decisionReason: true,
  decidedAt: true,
  createdAt: true,
} as const;

/** Historial del propio usuario, más nuevas primero. */
export async function listOwnProfileChangeRequests(
  registeredUserId: string,
): Promise<OwnProfileChangeRequest[]> {
  return prisma.profileChangeRequest.findMany({
    where: { requesterId: registeredUserId },
    select: OWN_SELECT,
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

/** ¿Hay otra cuenta con este DNI? (El DNI es único en `registered_users`.) */
async function dniTakenByOther(
  dni: string,
  registeredUserId: string,
): Promise<boolean> {
  const other = await prisma.registeredUser.findFirst({
    where: { dni, id: { not: registeredUserId } },
    select: { id: true },
  });
  return other !== null;
}

/**
 * Crea una solicitud. Reglas:
 * - el valor pedido tiene que ser distinto del actual;
 * - una sola pendiente por campo (además lo garantiza un índice único parcial en la base);
 * - un DNI pedido no puede pertenecer ya a otra cuenta (se vuelve a chequear al aprobar,
 *   porque entre medio otra persona puede haberse registrado con él).
 */
export async function createProfileChangeRequest(
  registeredUserId: string,
  input: {
    field: ProfileChangeField;
    requestedValue: string;
    justification: string;
  },
): Promise<OwnProfileChangeRequest> {
  const user = await prisma.registeredUser.findUnique({
    where: { id: registeredUserId },
    select: { dni: true, reasonToJoin: true },
  });
  if (!user) throw new DomainError("Usuario no encontrado", 404);

  const currentValue = user[FIELD_COLUMN[input.field]];
  if (currentValue.trim() === input.requestedValue.trim()) {
    throw new DomainError("El valor pedido es igual al actual", 400);
  }

  const pending = await prisma.profileChangeRequest.findFirst({
    where: {
      requesterId: registeredUserId,
      field: input.field,
      status: "PENDING",
    },
    select: { id: true },
  });
  if (pending) {
    throw new DomainError(
      "Ya tenés una solicitud pendiente para este dato. Cancelala si querés pedir otro valor.",
      409,
    );
  }

  if (
    input.field === "DNI" &&
    (await dniTakenByOther(input.requestedValue, registeredUserId))
  ) {
    throw new DomainError(
      "Ese DNI ya está registrado en otra cuenta. Escribinos si creés que es un error.",
      409,
    );
  }

  try {
    return await prisma.profileChangeRequest.create({
      data: {
        requesterId: registeredUserId,
        field: input.field,
        currentValue,
        requestedValue: input.requestedValue,
        justification: input.justification,
      },
      select: OWN_SELECT,
    });
  } catch (err) {
    // P2002: perdió la carrera contra otro envío simultáneo (índice parcial único).
    if ((err as { code?: string }).code === "P2002") {
      throw new DomainError(
        "Ya tenés una solicitud pendiente para este dato.",
        409,
      );
    }
    throw err;
  }
}

/** El usuario retira su propia solicitud, solo mientras está pendiente. */
export async function cancelProfileChangeRequest(
  registeredUserId: string,
  requestId: string,
): Promise<void> {
  const { count } = await prisma.profileChangeRequest.updateMany({
    where: { id: requestId, requesterId: registeredUserId, status: "PENDING" },
    data: { status: "CANCELLED", decidedAt: BigInt(nowMs()) },
  });
  if (count === 0) {
    throw new DomainError(
      "La solicitud no existe o ya fue resuelta, así que no se puede cancelar",
      404,
    );
  }
}

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

/** Fila de la cola del admin. */
export interface AdminProfileChangeRequest extends OwnProfileChangeRequest {
  requester: {
    id: string;
    name: string;
    lastName: string;
    email: string;
  };
  decidedBy: { name: string; lastName: string } | null;
  /**
   * Solo para pedidos de DNI pendientes: otra cuenta ya usa el DNI pedido. El admin lo ve
   * antes de decidir (aprobar fallaría igual, pero así sabe por qué).
   */
  dniConflict: boolean;
}

export type ProfileChangeStatusFilter = "PENDING" | "RESOLVED" | "ALL";

/** Cola del admin, paginada. Las pendientes salen de la más vieja a la más nueva (FIFO). */
export async function listProfileChangeRequestsForAdmin(opts: {
  status: ProfileChangeStatusFilter;
  page: number;
  pageSize: number;
}): Promise<{
  items: AdminProfileChangeRequest[];
  total: number;
  pendingCount: number;
}> {
  const where =
    opts.status === "PENDING"
      ? { status: "PENDING" as const }
      : opts.status === "RESOLVED"
        ? { status: { not: "PENDING" as const } }
        : {};

  const [rows, total, pendingCount] = await Promise.all([
    prisma.profileChangeRequest.findMany({
      where,
      select: {
        ...OWN_SELECT,
        requester: {
          select: {
            id: true,
            name: true,
            lastName: true,
            user: { select: { email: true, displayEmail: true } },
          },
        },
        decidedBy: { select: { name: true, lastName: true } },
      },
      orderBy: { createdAt: opts.status === "PENDING" ? "asc" : "desc" },
      skip: (opts.page - 1) * opts.pageSize,
      take: opts.pageSize,
    }),
    prisma.profileChangeRequest.count({ where }),
    prisma.profileChangeRequest.count({ where: { status: "PENDING" } }),
  ]);

  // Conflictos de DNI de las pendientes de esta página, en una sola consulta.
  const pendingDnis = rows
    .filter((r) => r.status === "PENDING" && r.field === "DNI")
    .map((r) => r.requestedValue);
  const owners = pendingDnis.length
    ? await prisma.registeredUser.findMany({
        where: { dni: { in: pendingDnis } },
        select: { id: true, dni: true },
      })
    : [];

  const items = rows.map(({ requester, ...r }) => ({
    ...r,
    requester: {
      id: requester.id,
      name: requester.name,
      lastName: requester.lastName,
      email: requester.user.displayEmail ?? requester.user.email,
    },
    dniConflict:
      r.status === "PENDING" &&
      r.field === "DNI" &&
      owners.some((o) => o.dni === r.requestedValue && o.id !== requester.id),
  }));

  return { items, total, pendingCount };
}

/** Lo que necesita la ruta para auditar la decisión. */
export interface ProfileChangeDecisionResult {
  requestId: string;
  requesterId: string;
  requesterName: string;
  field: ProfileChangeField;
  decision: "approve" | "reject";
  /** Valor del campo antes de aplicar (el real, no la foto de la solicitud). */
  previousValue: string;
  requestedValue: string;
}

/**
 * Aprueba o rechaza una solicitud pendiente. Al aprobar, escribe el valor pedido en el
 * perfil **en la misma transacción** que cierra la solicitud, así nunca queda una
 * aprobada sin aplicar ni un dato cambiado sin su aprobación.
 *
 * Reglas:
 * - quien decide no puede ser quien pidió (ni siquiera un superadmin);
 * - solo se decide una pendiente (el `updateMany` condicionado por estado evita que dos
 *   admins la resuelvan a la vez);
 * - un DNI que ya usa otra cuenta no se aprueba.
 */
export async function decideProfileChangeRequest(input: {
  requestId: string;
  deciderId: string;
  decision: "approve" | "reject";
  reason: string | null;
}): Promise<ProfileChangeDecisionResult> {
  return prisma.$transaction(async (tx) => {
    const request = await tx.profileChangeRequest.findUnique({
      where: { id: input.requestId },
      select: {
        id: true,
        requesterId: true,
        field: true,
        requestedValue: true,
        status: true,
        requester: {
          select: { name: true, lastName: true, dni: true, reasonToJoin: true },
        },
      },
    });
    if (!request) throw new DomainError("Solicitud no encontrada", 404);
    if (request.requesterId === input.deciderId) {
      throw new DomainError(
        "No podés resolver tu propia solicitud: tiene que hacerlo otra persona del equipo",
        403,
      );
    }
    if (request.status !== "PENDING") {
      throw new DomainError("La solicitud ya fue resuelta", 409);
    }

    const column = FIELD_COLUMN[request.field];
    const previousValue = request.requester[column];

    if (input.decision === "approve") {
      if (request.field === "DNI") {
        const taken = await tx.registeredUser.findFirst({
          where: {
            dni: request.requestedValue,
            id: { not: request.requesterId },
          },
          select: { id: true },
        });
        if (taken) {
          throw new DomainError(
            "Ese DNI ya pertenece a otra cuenta: no se puede aprobar",
            409,
          );
        }
      }
      await tx.registeredUser.update({
        where: { id: request.requesterId },
        data: { [column]: request.requestedValue },
      });
    }

    const { count } = await tx.profileChangeRequest.updateMany({
      where: { id: request.id, status: "PENDING" },
      data: {
        status: input.decision === "approve" ? "APPROVED" : "REJECTED",
        decidedById: input.deciderId,
        decisionReason: input.reason,
        decidedAt: BigInt(nowMs()),
      },
    });
    if (count === 0) {
      // Otro admin la resolvió entre la lectura y esta escritura: se deshace todo.
      throw new DomainError("La solicitud ya fue resuelta", 409);
    }

    return {
      requestId: request.id,
      requesterId: request.requesterId,
      requesterName: `${request.requester.name} ${request.requester.lastName}`,
      field: request.field,
      decision: input.decision,
      previousValue,
      requestedValue: request.requestedValue,
    };
  });
}
