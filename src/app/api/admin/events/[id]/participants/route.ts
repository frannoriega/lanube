import { requirePermission } from "@/lib/api-auth";
import { getEventFormColumns } from "@/lib/db/forms";
import { exportCell } from "@/lib/events/form-export";
import { listEventParticipants } from "@/lib/db/participants";
import { serializeJson } from "@/lib/json-bigint";
import { NextRequest, NextResponse } from "next/server";

function csvCell(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requirePermission("events:manage");
  if (error) return error;

  const { id } = await params;
  const [participants, columns] = await Promise.all([
    listEventParticipants(id),
    getEventFormColumns(id),
  ]);

  const { searchParams } = new URL(request.url);
  if (searchParams.get("format") === "csv") {
    const header = [
      "Email",
      "Email mostrado",
      "Cancelado",
      ...columns.map((c) => c.label),
    ];
    const lines = [header.map(csvCell).join(",")];
    for (const p of participants) {
      const answers = (p.answers ?? {}) as Record<string, unknown>;
      const row = [
        p.email,
        p.displayEmail ?? "",
        p.cancelled ? "sí" : "no",
        ...columns.map((c) => exportCell(c, answers)),
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
      fields: columns.map((c) => ({ id: c.key, label: c.label })),
      participants,
    }),
  );
}
