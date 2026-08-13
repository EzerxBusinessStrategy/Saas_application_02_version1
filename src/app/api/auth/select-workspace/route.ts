import { NextResponse } from "next/server";

export function POST() {
  return NextResponse.json({ message: "Workspace selection is no longer part of authentication." }, { status: 410 });
}
