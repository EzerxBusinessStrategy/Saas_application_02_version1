import { NextResponse } from "next/server";
import { demoSessionCookie } from "@/lib/demo-auth";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(demoSessionCookie, "", { maxAge: 0, path: "/" });
  return response;
}
