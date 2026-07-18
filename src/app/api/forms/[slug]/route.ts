import { nowMs } from "@/lib/clock";
import { getPublicForm, submitForm } from "@/modules/events/db/participants";
import { sendEventRegistrationEmail } from "@/modules/events/email/registration";
import { checkRateLimit } from "@/lib/ratelimit";
import { participantSubmitSchema } from "@/modules/events/schema";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

async function getIp(): Promise<string | null> {
  const h = await headers();
  return (
    h.get("cf-connecting-ip") ??
    h.get("x-real-ip") ??
    (process.env.NODE_ENV === "development"
      ? (h.get("x-forwarded-for")?.split(",")[0].trim() ?? "127.0.0.1")
      : null)
  );
}

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
  const { slug } = await params;
  const form = await getPublicForm(slug);
  if (!form) {
    return NextResponse.json(
      { message: "Formulario no encontrado" },
      { status: 404 },
    );
  }
  return NextResponse.json(form);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  const ip = await getIp();
  if (!ip) {
    return NextResponse.json({ message: "IP no encontrada" }, { status: 400 });
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

  const result = await submitForm(slug, parsed.data.email, parsed.data.answers);

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

  // Best-effort confirmation email (don't fail the registration if it bounces).
  if (result.token && result.eventName) {
    await sendEventRegistrationEmail(
      parsed.data.email,
      result.eventName,
      result.token,
      result.requiresApproval ?? false,
    );
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
