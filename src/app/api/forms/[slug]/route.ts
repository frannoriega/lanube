import { PUBLIC_TAGS, revalidatePublic } from "@/lib/cache/public-reads";
import { apiCatch } from "@/lib/api/response";
import { nowMs } from "@/lib/clock";
import { getPublicForm, submitForm } from "@/lib/db/participants";
import { sendEventRegistrationEmail } from "@/lib/email/event-registration";
import { logger } from "@/lib/logger";
import { checkRateLimit } from "@/lib/ratelimit";
import { getClientIp } from "@/lib/request-ip";
import { participantSubmitSchema } from "@/lib/schemas/events";
import { NextRequest, NextResponse } from "next/server";

const STATUS_MESSAGES: Record<string, string> = {
  closed: "El formulario no está disponible en este momento",
  full: "El evento alcanzó el cupo máximo",
  unpublished: "El formulario no está disponible",
  not_found: "Formulario no encontrado",
};

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;
    const form = await getPublicForm(slug);
    if (!form) {
      return NextResponse.json(
        { message: "Formulario no encontrado" },
        { status: 404 },
      );
    }
    return NextResponse.json(form);
  } catch (err) {
    return apiCatch("forms/[slug] GET", err);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;

    const ip = await getClientIp();
    if (!ip) {
      return NextResponse.json(
        { message: "IP no encontrada" },
        { status: 400 },
      );
    }
    const { allowed, resetAt } = await checkRateLimit(ip, "/api/forms/submit", {
      maxAttempts: 8,
      windowMs: 60_000,
      blockDurationMs: 300_000,
    });
    if (!allowed) {
      return NextResponse.json(
        {
          message: `Demasiadas solicitudes. Intentá nuevamente en ${Math.ceil(
            (resetAt.getTime() - nowMs()) / 1000,
          )} segundos`,
        },
        { status: 429 },
      );
    }

    const body = await request.json().catch(() => null);
    const parsed = participantSubmitSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { message: parsed.error.issues[0]?.message ?? "Datos inválidos" },
        { status: 400 },
      );
    }

    const result = await submitForm(
      slug,
      parsed.data.email,
      parsed.data.answers,
    );

    if (!result.ok) {
      if (result.status) {
        const status = result.status === "not_found" ? 404 : 409;
        return NextResponse.json(
          { message: STATUS_MESSAGES[result.status] ?? "No disponible" },
          { status },
        );
      }
      if (result.errors) {
        return NextResponse.json(
          { message: "Revisá los campos", errors: result.errors },
          { status: 400 },
        );
      }
      return NextResponse.json(
        { message: result.message ?? "No se pudo completar la inscripción" },
        { status: 409 },
      );
    }

    // Mail de confirmación best-effort — y ahora sí realmente best-effort. El `await` estaba
    // pelado dentro del try externo de la ruta, así que un timeout de SMTP devolvía un 500
    // *después* de haber commiteado la fila del participante: a la persona se le decía que la
    // inscripción falló, reintentaba, y recibía "Ya estás inscripto con ese email"
    // (milestone-12 D12).
    //
    // El mail es lo único que lleva su editToken, así que una falla vale loguearla fuerte —
    // simplemente no vale hacer fallar una inscripción que ya salió bien. Mismo razonamiento
    // que las notificaciones de sesiones y de decisiones, que a propósito se envían después de
    // que su transacción commitea.
    if (result.token && result.eventName) {
      try {
        await sendEventRegistrationEmail(
          parsed.data.email,
          result.eventName,
          result.token,
          result.requiresApproval ?? false,
        );
      } catch (err) {
        logger.error("forms/[slug] POST confirmation email failed", err, {
          slug,
        });
      }
    }

    // Un lugar menos: la tarjeta del evento puede pasar a «completo» (milestone 25, P2).
    revalidatePublic(PUBLIC_TAGS.events);
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err) {
    return apiCatch("forms/[slug] POST", err);
  }
}
