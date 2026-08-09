import { NextResponse } from "next/server";
import {
  superAdminAccessTokenCookie,
  superAdminRefreshTokenCookie,
  superAdminRememberMeCookie,
  authenticatedWorkspaceCookie,
} from "@/lib/auth-cookies";

type CookieSession = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
};

const maxRememberMeAge = 60 * 60 * 24;

export function setSuperAdminSessionCookies(
  response: NextResponse,
  session: CookieSession,
  rememberMe: boolean,
  workspace: "super-admin" | "admin" | "client" = "super-admin",
): void {
  const common = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
  };
  const accessMaxAge = Math.max(60, Math.min(session.expiresIn, maxRememberMeAge));
  response.cookies.set(superAdminAccessTokenCookie, session.accessToken, {
    ...common,
    ...(rememberMe ? { maxAge: accessMaxAge } : {}),
  });
  response.cookies.set(superAdminRefreshTokenCookie, session.refreshToken, {
    ...common,
    ...(rememberMe ? { maxAge: maxRememberMeAge } : {}),
  });
  response.cookies.set(superAdminRememberMeCookie, rememberMe ? "1" : "0", {
    ...common,
    ...(rememberMe ? { maxAge: maxRememberMeAge } : {}),
  });
  response.cookies.set(authenticatedWorkspaceCookie, workspace, { ...common, ...(rememberMe ? { maxAge: maxRememberMeAge } : {}) });
}

export function clearSuperAdminSessionCookies(response: NextResponse): void {
  response.cookies.set(superAdminAccessTokenCookie, "", { maxAge: 0, path: "/" });
  response.cookies.set(superAdminRefreshTokenCookie, "", { maxAge: 0, path: "/" });
  response.cookies.set(superAdminRememberMeCookie, "", { maxAge: 0, path: "/" });
  response.cookies.set(authenticatedWorkspaceCookie, "", { maxAge: 0, path: "/" });
}
