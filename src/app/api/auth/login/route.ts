import { NextResponse } from "next/server";

export function POST() {
  return NextResponse.json({ message: "This authentication endpoint has been retired. Use a portal-specific login." }, { status: 410 });
}
