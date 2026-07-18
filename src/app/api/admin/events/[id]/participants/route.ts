import { requirePermission } from "@/lib/api-auth";
import { PARTICIPANT_STATUS_LABEL } from "@/lib/constants/participants";
import { getEventFormColumns } from "@/modules/events/db/forms";
import {
  cellFiles,
  type ExportColumn,
  exportCell,
} from "@/modules/events/lib/form-export";
import { listEventParticipants } from "@/modules/events/db/participants";
import { serializeJson } from "@/lib/json-bigint";
import { ParticipantStatus } from "@/types/prisma";
import { NextRequest, NextResponse } from "next/server";

function csvCell(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

/**
 * CSV value for a column: for FILE fields, "filename (download-url)" per file (a bare filename
 * isn't retrievable from a spreadsheet); otherwise the plain text answer.
 */
function csvValue(
  col: ExportColumn,
  answers: Record<string, unknown>,
  origin: string,
  eventId: string,
): string {
  const files = cellFiles(col, answers);
  if (files.length > 0) {
    return files
      .map(
        (f) =>
          `${f.name} (${origin}/api/admin/events/${eventId}/participants/file?url=${encodeURIComponent(
            f.url,
          )}&download=1)`,
      )
      .join(" | ");
  }
  return exportCell(col, answers);
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

  const { origin, searchParams } = new URL(request.url);
  if (searchParams.get("format") === "csv") {
    const header = [
      "Email",
      "Email mostrado",
      "Estado",
      ...columns.map((c) => c.label),
    ];
    const lines = [header.map(csvCell).join(",")];
    for (const p of participants) {
      const answers = (p.answers ?? {}) as Record<string, unknown>;
      const row = [
        p.email,
        p.displayEmail ?? "",
        PARTICIPANT_STATUS_LABEL[p.status as ParticipantStatus],
        ...columns.map((c) => csvValue(c, answers, origin, id)),
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
