import { NextResponse } from "next/server";
import { demoSessionCookie } from "@/lib/demo-auth";
import { clearSuperAdminSessionCookies } from "@/lib/server/super-admin-session-cookies";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(demoSessionCookie, "", { maxAge: 0, path: "/" });
  clearSuperAdminSessionCookies(response);
  return response;
}
