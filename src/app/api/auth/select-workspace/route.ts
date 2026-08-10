import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createClientPortalSessionPolicy,
  createEmployeeSessionPolicy,
  createManagerSessionPolicy,
  createSuperAdminSessionPolicy,
  createTenantAdminSessionPolicy,
} from "@/lib/server/super-admin-auth";
import {
  setSuperAdminSessionCookies,
} from "@/lib/server/super-admin-session-cookies";
import { superAdminAccessTokenCookie, superAdminRefreshTokenCookie, superAdminRememberMeCookie } from "@/lib/auth-cookies";
import { cookies } from "next/headers";
import type { Workspace } from "@/types/domain";

const selectSchema = z.object({
  workspace: z.enum(["super-admin", "admin", "manager", "employee", "client"]),
  tenantId: z.string().uuid().optional(),
});

/**
 * POST /api/auth/select-workspace
 *
 * After authenticating, the user selects a workspace from the selector.
 * This creates the appropriate session policy and sets cookies for the
 * chosen workspace.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = selectSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid workspace selection." }, { status: 400 });
  }

  const { workspace } = parsed.data;
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(superAdminAccessTokenCookie)?.value;
  const refreshToken = cookieStore.get(superAdminRefreshTokenCookie)?.value;
  const rememberMe = cookieStore.get(superAdminRememberMeCookie)?.value === "1";

  if (!accessToken || !refreshToken) {
    return NextResponse.json(
      { message: "Your session has expired. Please sign in again." },
      { status: 401 },
    );
  }

  const policyCreated = await createPolicyForWorkspace(
    workspace,
    accessToken,
    rememberMe,
  );

  if (!policyCreated) {
    return NextResponse.json(
      { message: "Unable to establish your session. Please try again." },
      { status: 503 },
    );
  }

  const response = NextResponse.json({ redirect: `/${workspace}` });
  setSuperAdminSessionCookies(
    response,
    { accessToken, refreshToken, expiresIn: 3600 },
    rememberMe,
    workspace,
  );

  return response;
}

function createPolicyForWorkspace(
  workspace: Workspace,
  accessToken: string,
  rememberMe: boolean,
): Promise<boolean> {
  if (workspace === "super-admin") return createSuperAdminSessionPolicy(accessToken, rememberMe);
  if (workspace === "client") return createClientPortalSessionPolicy(accessToken, rememberMe);
  if (workspace === "manager") return createManagerSessionPolicy(accessToken, rememberMe);
  if (workspace === "employee") return createEmployeeSessionPolicy(accessToken, rememberMe);
  return createTenantAdminSessionPolicy(accessToken, rememberMe);
}
