import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { clientSessionCookie, employeeSessionCookie, superAdminSessionCookie, tenantSessionCookie } from "@/lib/auth-cookies";
import { appLocaleCookie, locales, timezones } from "@/i18n/config";
import { proxyClientPortalBackend } from "@/lib/server/client-portal-backend-proxy";
import { proxyEmployeeBackend } from "@/lib/server/employee-backend-proxy";
import { proxySuperAdminBackend } from "@/lib/server/super-admin-backend-proxy";
import { proxyTenantAdminBackend } from "@/lib/server/tenant-admin-backend-proxy";

const preferenceSchema = z.object({
  locale: z.enum(locales),
  timezone: z.enum(timezones.map((entry) => entry.timezone) as [string, ...string[]]),
});

export async function PATCH(request: Request) {
  const parsed = preferenceSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ message: "Choose a supported language and time zone." }, { status: 400 });
  }

  const cookieStore = await cookies();
  const workspace = cookieStore.get(superAdminSessionCookie)?.value ? "super-admin" : cookieStore.get(tenantSessionCookie)?.value ? "admin" : cookieStore.get(employeeSessionCookie)?.value ? "employee" : cookieStore.get(clientSessionCookie)?.value ? "client" : undefined;
  const init = {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(parsed.data),
  };
  const response = await proxyForWorkspace(workspace, init);
  if (response.ok) {
    response.cookies.set(appLocaleCookie, parsed.data.locale, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
  }
  return response;
}

function proxyForWorkspace(workspace: string | undefined, init: RequestInit): Promise<NextResponse> {
  switch (workspace) {
    case "super-admin":
      return proxySuperAdminBackend({
        path: "/me/preferences",
        init,
        unauthenticatedMessage: "Sign in to update your preferences.",
        unavailableMessage: "Preferences are unavailable.",
      });
    case "admin":
      return proxyTenantAdminBackend({ path: "/me/preferences", init, unavailableMessage: "Preferences are unavailable." });
    case "employee":
      return proxyEmployeeBackend({ path: "/me/preferences", init, unavailableMessage: "Preferences are unavailable." });
    case "client":
      return proxyClientPortalBackend({ path: "/me/preferences", init, unavailableMessage: "Preferences are unavailable." });
    default:
      return Promise.resolve(NextResponse.json({ message: "Sign in to update your preferences." }, { status: 401 }));
  }
}
