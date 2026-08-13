import { NextResponse } from "next/server";

/** @deprecated Sign-in URLs select the portal. */
export async function POST(): Promise<NextResponse> {
  return NextResponse.json({ message: "Portal selection is part of the sign-in URL." }, { status: 410 });
}
