import { NextResponse } from "next/server";
import { z } from "zod";
import { demoSessionCookie, loginRoles, validateDemoLogin } from "@/lib/demo-auth";
import {
  createSuperAdminSessionPolicy,
  createTenantAdminSessionPolicy,
  fetchVerifiedSuperAdminMe,
  fetchVerifiedTenantAdminMe,
  signInSuperAdminWithPassword,
} from "@/lib/server/super-admin-auth";
import { clearSuperAdminSessionCookies, setSuperAdminSessionCookies } from "@/lib/server/super-admin-session-cookies";

const loginSchema = z.object({
  identifier: z.string().min(1),
  password: z.string().min(1),
  role: z.enum(loginRoles),
  rememberMe: z.boolean().optional().default(false),
});

export async function POST(request: Request) {
  const parsed = loginSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { message: "The sign-in details do not match the selected portal." },
      { status: 401 },
    );
  }

  const rememberMe = parsed.success ? parsed.data.rememberMe : false;
  if (parsed.data.role === "SUPER_ADMIN" || parsed.data.role === "TENANT_ADMIN") {
    try {
      const session = await signInSuperAdminWithPassword({
        email: parsed.data.identifier,
        password: parsed.data.password,
      });
      if (!session) {
        return NextResponse.json(
          { message: "The sign-in details do not match the selected portal." },
          { status: 401 },
        );
      }
      const isSuperAdmin = parsed.data.role === "SUPER_ADMIN";
      if (!(isSuperAdmin ? await createSuperAdminSessionPolicy(session.accessToken, rememberMe) : await createTenantAdminSessionPolicy(session.accessToken, rememberMe))) {
        return NextResponse.json(
          { message: "Super Admin authentication is not available right now." },
          { status: 503 },
        );
      }
      if (!(isSuperAdmin ? await fetchVerifiedSuperAdminMe(session.accessToken) : await fetchVerifiedTenantAdminMe(session.accessToken))) {
        return NextResponse.json(
          { message: "The sign-in details do not match the selected portal." },
          { status: 401 },
        );
      }

      const workspace = isSuperAdmin ? "super-admin" : "admin";
      const response = NextResponse.json({ workspace });
      setSuperAdminSessionCookies(response, session, rememberMe, workspace);
      response.cookies.set(demoSessionCookie, "", { maxAge: 0, path: "/" });
      return response;
    } catch {
      return NextResponse.json(
        { message: "Super Admin authentication is not available right now." },
        { status: 503 },
      );
    }
  }

  const session = validateDemoLogin(parsed.data);
  if (!session) {
    return NextResponse.json(
      { message: "The sign-in details do not match the selected portal." },
      { status: 401 },
    );
  }

  const response = NextResponse.json({ workspace: session.workspace });
  clearSuperAdminSessionCookies(response);
  response.cookies.set(demoSessionCookie, session.role, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: rememberMe ? 60 * 60 * 24 * 30 : 60 * 60 * 8,
    path: "/",
  });
  return response;
}
