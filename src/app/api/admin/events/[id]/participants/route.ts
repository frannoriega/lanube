import { auth } from "@/lib/auth";
import { isAdminUser } from "@/lib/db/adminReservations";
import { getEventFormFields } from "@/lib/db/forms";
import { listEventParticipants } from "@/lib/db/participants";
import { serializeJson } from "@/lib/json-bigint";
import { NextRequest, NextResponse } from "next/server";

function csvCell(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function answerToString(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (Array.isArray(value)) return value.join("; ");
  return String(value);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.userId) {
    return NextResponse.json({ message: "No autorizado" }, { status: 401 });
  }
  if (!(await isAdminUser(session.userId))) {
    return NextResponse.json({ message: "Acceso denegado" }, { status: 403 });
  }

  const { id } = await params;
  const [participants, fields] = await Promise.all([
    listEventParticipants(id),
    getEventFormFields(id),
  ]);

  const { searchParams } = new URL(request.url);
  if (searchParams.get("format") === "csv") {
    const header = [
      "Email",
      "Email mostrado",
      "Cancelado",
      ...fields.map((f) => f.label),
    ];
    const lines = [header.map(csvCell).join(",")];
    for (const p of participants) {
      const answers = (p.answers ?? {}) as Record<string, unknown>;
      const row = [
        p.email,
        p.displayEmail ?? "",
        p.cancelled ? "sí" : "no",
        ...fields.map((f) => answerToString(answers[f.id])),
      ];
      lines.push(row.map(csvCell).join(","));
    }
    return new NextResponse(lines.join("\n"), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="participantes-${id}.csv"`,
      },
    });
  }

  return NextResponse.json(
    serializeJson({
      fields: fields.map((f) => ({ id: f.id, label: f.label })),
      participants,
    }),
  );
}
