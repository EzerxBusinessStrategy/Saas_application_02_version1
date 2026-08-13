import { NextResponse } from "next/server";

/** @deprecated Use one of the portal-specific login endpoints. */
export async function POST(): Promise<NextResponse> {
  return NextResponse.json({ message: "Use a portal-specific sign-in endpoint." }, { status: 410 });
}
