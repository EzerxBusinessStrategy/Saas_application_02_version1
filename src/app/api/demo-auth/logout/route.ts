import { NextResponse } from "next/server";
export async function POST(): Promise<NextResponse> {
  return NextResponse.json({ message: "Demo authentication has been retired." }, { status: 410 });
}
