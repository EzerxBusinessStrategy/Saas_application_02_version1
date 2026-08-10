import { NextResponse } from "next/server";
import { z } from "zod";
import { demoSessionCookie, validateDemoLogin } from "@/lib/demo-auth";
import {
  signInSuperAdminWithPassword,
  fetchVerifiedSuperAdminMe,
  fetchVerifiedTenantAdminMe,
  fetchVerifiedClientPortalMe,
  fetchVerifiedManagerMe,
  fetchVerifiedEmployeeMe,
  createSuperAdminSessionPolicy,
  createTenantAdminSessionPolicy,
  createClientPortalSessionPolicy,
  createManagerSessionPolicy,
  createEmployeeSessionPolicy,
} from "@/lib/server/super-admin-auth";
import {
  clearSuperAdminSessionCookies,
  setSuperAdminSessionCookies,
} from "@/lib/server/super-admin-session-cookies";
import {
  resolveWorkspaces,
  autoSelectWorkspace,
  workspaceForRoles,
} from "@/lib/workspace-resolver";

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().min(1, "Enter your email."),
  password: z.string().min(1, "Enter your password."),
  rememberMe: z.boolean().optional().default(false),
});

type MeResponse = {
  user: { id: string; email: string; displayName: string };
  availableMemberships: {
    id: string;
    displayName: string;
    tenant: { id: string; code: string; displayName: string };
    roles: readonly string[];
  }[];
  activeMembership: unknown;
  roles: readonly string[];
  permissions: readonly string[];
  isPlatformAdmin: boolean;
};

/**
 * POST /api/auth/login
 *
 * Unified login endpoint that replaces the role-dependent `/api/demo-auth/login`.
 * Accepts `{ email, password, rememberMe }` — no role field.
 *
 * Flow:
 * 1. Try Supabase Auth password sign-in
 * 2. If Supabase succeeds → call backend `/me` → resolve workspace(s)
 * 3. If single workspace → set cookies + return redirect URL
 * 4. If multiple workspaces → set auth cookies + return redirect to /select-workspace
 * 5. If Supabase fails → fall back to demo auth for dev/testing
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: "Please enter your email and password." },
      { status: 400 },
    );
  }

  const { email, password, rememberMe } = parsed.data;

  // --- Attempt Supabase Auth sign-in ---
  try {
    const session = await signInSuperAdminWithPassword({ email, password });

    if (session) {
      console.log("[Login Route] Creating Super Admin session policy...");
      const policyOk = await createSuperAdminSessionPolicy(session.accessToken, rememberMe);
      console.log("[Login Route] Session policy result:", policyOk);

      console.log("[Login Route] Fetching me context...");
      let meData = await fetchMeContext(session.accessToken);
      console.log("[Login Route] Me context result:", meData ? "Found" : "Null");

      if (!meData) {
        console.log("[Login Route] Trying tenant admin session policy...");
        await createTenantAdminSessionPolicy(session.accessToken, rememberMe);
        meData = await fetchMeContext(session.accessToken);
      }
      if (!meData) {
        console.log("[Login Route] Trying client portal session policy...");
        await createClientPortalSessionPolicy(session.accessToken, rememberMe);
        meData = await fetchMeContext(session.accessToken);
      }
      if (!meData) {
        console.log("[Login Route] Trying employee session policy...");
        await createEmployeeSessionPolicy(session.accessToken, rememberMe);
        meData = await fetchMeContext(session.accessToken);
      }
      if (!meData) {
        console.log("[Login Route] Trying manager session policy...");
        await createManagerSessionPolicy(session.accessToken, rememberMe);
        meData = await fetchMeContext(session.accessToken);
      }

      if (meData) {
        const workspaces = resolveWorkspaces({
          isPlatformAdmin: meData.isPlatformAdmin,
          roles: [...meData.roles],
          availableMemberships: meData.availableMemberships,
          activeMembership: meData.activeMembership,
        });

        const single = autoSelectWorkspace(workspaces);

        if (single) {
          const workspace = single.workspace;
          const response = NextResponse.json({ redirect: `/${workspace}` });
          setSuperAdminSessionCookies(response, session, rememberMe, workspace);
          response.cookies.set(demoSessionCookie, "", { maxAge: 0, path: "/" });
          return response;
        }

        if (workspaces.length > 1) {
          const response = NextResponse.json({ redirect: "/select-workspace" });
          setSuperAdminSessionCookies(
            response,
            session,
            rememberMe,
            "super-admin",
          );
          response.cookies.set(demoSessionCookie, "", { maxAge: 0, path: "/" });
          return response;
        }

        return NextResponse.json(
          { message: "Your account does not have access to any workspace. Contact your administrator." },
          { status: 403 },
        );
      }
    }
  } catch (error) {
    console.error("[Login Route] Exception during Supabase Auth:", error);
  }

  // --- Demo auth fallback (for development/testing) ---
  // Try each demo role to find a matching credential set
  const demoRoles = ["TENANT_ADMIN", "MANAGER", "EMPLOYEE", "CLIENT_USER"] as const;
  for (const role of demoRoles) {
    const demoSession = validateDemoLogin({
      identifier: email,
      password,
      role,
    });
    if (demoSession) {
      const response = NextResponse.json({
        redirect: `/${demoSession.workspace}`,
      });
      clearSuperAdminSessionCookies(response);
      response.cookies.set(demoSessionCookie, demoSession.role, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: rememberMe ? 60 * 60 * 24 * 30 : 60 * 60 * 8,
        path: "/",
      });
      return response;
    }
  }

  return NextResponse.json(
    { message: "Invalid email or password. Please try again." },
    { status: 401 },
  );
}

/**
 * Fetch the user's membership context from the backend.
 * Tries each supported real portal.
 */
async function fetchMeContext(
  accessToken: string,
): Promise<MeResponse | null> {
  // Check super-admin first
  const superAdminMe = await fetchVerifiedSuperAdminMe(accessToken);
  if (superAdminMe) {
    // Platform admin — construct a MeResponse-compatible shape
    return {
      user: {
        id: "",
        email: superAdminMe.user.email,
        displayName: superAdminMe.user.displayName,
      },
      availableMemberships: [],
      activeMembership: null,
      roles: superAdminMe.roles,
      permissions: [],
      isPlatformAdmin: superAdminMe.isPlatformAdmin,
    };
  }

  // Check tenant admin
  const tenantAdminMe = await fetchVerifiedTenantAdminMe(accessToken);
  if (tenantAdminMe) {
    return {
      user: {
        id: "",
        email: tenantAdminMe.user.email,
        displayName: tenantAdminMe.user.displayName,
      },
      availableMemberships: [],
      activeMembership: tenantAdminMe.activeMembership,
      roles: tenantAdminMe.roles,
      permissions: [],
      isPlatformAdmin: false,
    };
  }

  const clientPortalMe = await fetchVerifiedClientPortalMe(accessToken);
  if (clientPortalMe) {
    return {
      user: {
        id: "",
        email: clientPortalMe.user.email,
        displayName: clientPortalMe.user.displayName,
      },
      availableMemberships: [],
      activeMembership: clientPortalMe.activeMembership,
      roles: clientPortalMe.roles,
      permissions: [],
      isPlatformAdmin: false,
    };
  }

  const employeeMe = await fetchVerifiedEmployeeMe(accessToken);
  if (employeeMe) {
    return {
      user: {
        id: "",
        email: employeeMe.user.email,
        displayName: employeeMe.user.displayName,
      },
      availableMemberships: [],
      activeMembership: employeeMe.activeMembership,
      roles: employeeMe.roles,
      permissions: [],
      isPlatformAdmin: false,
    };
  }

  const managerMe = await fetchVerifiedManagerMe(accessToken);
  if (managerMe) {
    return {
      user: {
        id: "",
        email: managerMe.user.email,
        displayName: managerMe.user.displayName,
      },
      availableMemberships: [],
      activeMembership: managerMe.activeMembership,
      roles: managerMe.roles,
      permissions: [],
      isPlatformAdmin: false,
    };
  }

  return null;
}
