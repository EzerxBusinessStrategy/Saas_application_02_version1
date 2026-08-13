import { NextResponse } from "next/server";

export function POST() {
  return NextResponse.json({ message: "This authentication endpoint has been retired. Choose a portal login." }, { status: 410 });
}
