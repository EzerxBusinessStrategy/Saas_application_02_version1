import { NextResponse } from "next/server";
import { z } from "zod";
import { demoSessionCookie, loginRoles, validateDemoLogin } from "@/lib/demo-auth";

const loginSchema = z.object({
  identifier: z.string().min(1),
  password: z.string().min(1),
  role: z.enum(loginRoles),
  rememberMe: z.boolean().optional().default(false),
});

export async function POST(request: Request) {
  const parsed = loginSchema.safeParse(await request.json());
  const session = parsed.success ? validateDemoLogin(parsed.data) : null;
  const rememberMe = parsed.success ? parsed.data.rememberMe : false;
  if (!session) {
    return NextResponse.json(
      { message: "The sign-in details do not match the selected portal." },
      { status: 401 },
    );
  }

  const response = NextResponse.json({ workspace: session.workspace });
  response.cookies.set(demoSessionCookie, session.role, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: rememberMe ? 60 * 60 * 24 * 30 : 60 * 60 * 8,
    path: "/",
  });
  return response;
}
