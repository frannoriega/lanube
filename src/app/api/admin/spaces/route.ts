import { requirePermission } from "@/lib/api-auth";
import { createSpace, getPublicSpaces } from "@/lib/db/spaces";
import { serializeJson } from "@/lib/json-bigint";
import { spaceInputSchema } from "@/lib/schemas/config";
import { NextRequest, NextResponse } from "next/server";

// GET: list spaces. `?reservable=1` narrows to reservable ones (event-form picker);
// any admin can read, mutations need spaces:manage.
export async function GET(request: NextRequest) {
  const { error } = await requirePermission("admin:access");
  if (error) return error;

  const reservableOnly =
    new URL(request.url).searchParams.get("reservable") === "1";
  const spaces = await getPublicSpaces();
  return NextResponse.json(
    serializeJson(
      reservableOnly ? spaces.filter((s) => s.isReservable) : spaces,
    ),
  );
}

export async function POST(request: NextRequest) {
  const { error } = await requirePermission("spaces:manage");
  if (error) return error;

  const body = await request.json().catch(() => null);
  const parsed = spaceInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        message: parsed.error.issues[0]?.message ?? "Datos inválidos",
        issues: parsed.error.issues,
      },
      { status: 400 },
    );
  }

  try {
    const space = await createSpace(parsed.data);
    return NextResponse.json(serializeJson(space), { status: 201 });
  } catch (e) {
    const message =
      e instanceof Error && e.message.includes("Unique constraint")
        ? "Ya existe un espacio con ese slug"
        : "No se pudo crear el espacio";
    return NextResponse.json({ message }, { status: 400 });
  }
}
