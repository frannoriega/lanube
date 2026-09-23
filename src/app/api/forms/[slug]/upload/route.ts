import { apiCatch } from "@/lib/api/response";
import { getPublicForm } from "@/lib/db/participants";
import { handleParticipantUpload } from "@/lib/events/participant-upload";
import { NextRequest, NextResponse } from "next/server";

/** Uploads a file for a FILE field while filling out a form (submit flow). */
export async function POST(
  request: NextRequest,
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
    if (form.status !== "open") {
      return NextResponse.json(
        { message: "El formulario no está disponible" },
        { status: 409 },
      );
    }
    return handleParticipantUpload(request, form.schema, [
      "events",
      "participant-uploads",
      slug,
    ]);
  } catch (err) {
    return apiCatch("forms/[slug]/upload POST", err);
  }
}
