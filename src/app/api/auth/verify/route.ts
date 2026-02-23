import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const { token } = await request.json();
  const token = await verifyResetToken(token);
  if (!token) {
    return NextResponse.json({ message: "Token inválido" }, { status: 400 });
  }
  return NextResponse.json({ message: "Token válido" }, { status: 200 });
}