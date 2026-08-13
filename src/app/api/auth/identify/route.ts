import { NextResponse } from "next/server";
export async function POST(): Promise<NextResponse> {
  return NextResponse.json({ message: "Use a portal-specific sign-in endpoint." }, { status: 410 });
}
