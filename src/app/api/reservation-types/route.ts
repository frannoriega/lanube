import { listReservationTypes } from "@/lib/db/reservationTypes";
import { serializeJson } from "@/lib/json-bigint";
import { NextResponse } from "next/server";

// GET: the reservation-type catalog (public read — names already appear on public
// event pages). Powers type selects in the booking calendar and the admin event form.
export async function GET() {
  const types = await listReservationTypes();
  return NextResponse.json(serializeJson(types));
}
