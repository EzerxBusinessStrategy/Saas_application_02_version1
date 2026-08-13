import { NextResponse } from "next/server";

export function POST() {
  return NextResponse.json({ message: "Demo authentication has been retired." }, { status: 410 });
}
