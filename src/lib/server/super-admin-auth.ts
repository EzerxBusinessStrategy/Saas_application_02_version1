import type { Role, User, Workspace } from "@/types/domain";
import { defaultLocale, timezones, type AppLocale, type AppTimezone } from "@/i18n/config";
import { rolePermissions } from "@/lib/permissions";

type SupabasePasswordSession = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
};

const supabaseAuthTimeoutMs = 5000;

type SuperAdminMe = {
  user: {
    id?: string;
    email: string;
    displayName: string;
  };
  preferences?: {
    locale: AppLocale;
    timezone: AppTimezone;
  };
  activeMembership: null | {
    tenant?: {
      displayName?: string;
    };
  };
  roles: string[];
  isPlatformAdmin: boolean;
};

export type SuperAdminLoginSession = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
};

export async function signInSuperAdminWithPassword({
  email,
  password,
}: {
  email: string;
  password: string;
}): Promise<SuperAdminLoginSession | null> {
  const supabaseUrl = requiredServerEnv("BACKEND_SUPABASE_URL");
  const supabaseAnonKey = requiredServerEnv("BACKEND_SUPABASE_ANON_KEY");
  const response = await fetchWithTimeout(`${stripTrailingSlash(supabaseUrl)}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      apikey: supabaseAnonKey,
      "content-type": "application/json",
    },
    body: JSON.stringify({ email, password }),
    cache: "no-store",
  });

  if (!response.ok) return null;
  const session = (await response.json()) as SupabasePasswordSession;
  if (!session.access_token || !session.refresh_token) return null;

  return {
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
    expiresIn: session.expires_in ?? 3600,
  };
}

export async function refreshSuperAdminSession(refreshToken: string): Promise<Pick<SuperAdminLoginSession, "accessToken" | "refreshToken" | "expiresIn"> | null> {
  const supabaseUrl = requiredServerEnv("BACKEND_SUPABASE_URL");
  const supabaseAnonKey = requiredServerEnv("BACKEND_SUPABASE_ANON_KEY");
  const response = await fetchWithTimeout(`${stripTrailingSlash(supabaseUrl)}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    headers: {
      apikey: supabaseAnonKey,
      "content-type": "application/json",
    },
    body: JSON.stringify({ refresh_token: refreshToken }),
    cache: "no-store",
  });

  if (!response.ok) return null;
  const session = (await response.json()) as SupabasePasswordSession;
  if (!session.access_token || !session.refresh_token) return null;

  return {
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
    expiresIn: session.expires_in ?? 3600,
  };
}

export async function createSuperAdminSessionPolicy(accessToken: string, rememberMe: boolean): Promise<boolean> {
  return createSessionPolicy(accessToken, rememberMe, "super-admin");
}

export async function createTenantAdminSessionPolicy(accessToken: string, rememberMe: boolean): Promise<boolean> {
  return createSessionPolicy(accessToken, rememberMe, "admin");
}

export async function createClientPortalSessionPolicy(accessToken: string, rememberMe: boolean): Promise<boolean> {
  return createSessionPolicy(accessToken, rememberMe, "client");
}

export async function createEmployeeSessionPolicy(accessToken: string, rememberMe: boolean): Promise<boolean> {
  return createSessionPolicy(accessToken, rememberMe, "employee");
}

export async function revokeSessionPolicy(
  accessToken: string,
  workspace: Workspace,
): Promise<void> {
  await fetch(`${backendApiBaseUrl()}/auth/session-policy`, {
    method: "DELETE",
    headers: { authorization: `Bearer ${accessToken}`, "x-portal": workspace },
    cache: "no-store",
  }).catch(() => undefined);
}

async function createSessionPolicy(accessToken: string, rememberMe: boolean, portal: Workspace): Promise<boolean> {
  const response = await fetch(`${backendApiBaseUrl()}/auth/session-policy`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
      "x-portal": portal,
    },
    body: JSON.stringify({ rememberMe }),
    cache: "no-store",
  });
  return response.ok;
}

export async function fetchVerifiedSuperAdminMe(accessToken: string): Promise<SuperAdminMe | null> {
  const response = await fetch(`${backendApiBaseUrl()}/me`, {
    headers: {
      authorization: `Bearer ${accessToken}`,
      "x-portal": "super-admin",
    },
    cache: "no-store",
  }).catch(() => null);
  if (!response) return null;
  if (!response.ok) return null;

  const me = (await response.json()) as SuperAdminMe;
  if (!me.isPlatformAdmin || !me.roles.includes("SUPER_ADMIN") || me.activeMembership !== null) {
    return null;
  }
  return me;
}

export async function fetchVerifiedTenantAdminMe(accessToken: string): Promise<SuperAdminMe | null> {
  return fetchVerifiedWorkspaceMe(accessToken, "admin", ["TENANT_OWNER", "TENANT_ADMIN", "FINANCE_USER", "HR_OPERATIONS_USER"]);
}

export async function fetchVerifiedClientPortalMe(accessToken: string): Promise<SuperAdminMe | null> {
  return fetchVerifiedWorkspaceMe(accessToken, "client", ["CLIENT_USER"]);
}

export async function fetchVerifiedEmployeeMe(accessToken: string): Promise<SuperAdminMe | null> {
  return fetchVerifiedWorkspaceMe(accessToken, "employee", ["EMPLOYEE"]);
}

async function fetchVerifiedWorkspaceMe(
  accessToken: string,
  portal: Workspace,
  allowedRoles: readonly Role[],
): Promise<SuperAdminMe | null> {
  const response = await fetch(`${backendApiBaseUrl()}/me`, {
    headers: { authorization: `Bearer ${accessToken}`, "x-portal": portal },
    cache: "no-store",
  }).catch(() => null);
  if (!response) return null;
  if (!response.ok) return null;
  const me = (await response.json()) as SuperAdminMe;
  if (me.isPlatformAdmin || !allowedRoles.some((role) => me.roles.includes(role)) || !me.activeMembership) return null;
  return me;
}

export async function updateVerifiedSuperAdminProfile({
  accessToken,
  displayName,
}: {
  accessToken: string;
  displayName: string;
}): Promise<SuperAdminMe | null> {
  const response = await fetch(`${backendApiBaseUrl()}/me/profile`, {
    method: "PATCH",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
      "x-portal": "super-admin",
    },
    body: JSON.stringify({ displayName }),
    cache: "no-store",
  });
  if (!response.ok) return null;

  const me = (await response.json()) as SuperAdminMe;
  if (!me.isPlatformAdmin || !me.roles.includes("SUPER_ADMIN") || me.activeMembership !== null) {
    return null;
  }
  return me;
}

export function userFromSuperAdminMe(me: SuperAdminMe): User {
  return {
    name: me.user.displayName,
    email: me.user.email,
    initials: initialsFromName(me.user.displayName),
    role: "SUPER_ADMIN",
    permissions: rolePermissions.SUPER_ADMIN,
    preferences: preferencesFor(me),
  };
}

export function userFromTenantAdminMe(me: SuperAdminMe): User {
  const user = userFromMe(me, "TENANT_ADMIN");
  const tenantName = me.activeMembership?.tenant?.displayName?.trim();
  if (!tenantName) return user;

  return {
    ...user,
    name: tenantName,
    initials: initialsFromName(tenantName),
  };
}

export function userFromClientPortalMe(me: SuperAdminMe): User {
  return userFromMe(me, "CLIENT_USER");
}

export function userFromEmployeeMe(me: SuperAdminMe): User {
  return userFromMe(me, "EMPLOYEE", "EMPLOYEE");
}

function userFromMe(me: SuperAdminMe, fallbackRole: Role, preferredRole?: Role): User {
  const roles = me.roles.filter((candidate): candidate is Role => candidate in rolePermissions);
  const role = (preferredRole && roles.includes(preferredRole) ? preferredRole : roles[0]) ?? fallbackRole;
  return {
    name: me.user.displayName,
    email: me.user.email,
    initials: initialsFromName(me.user.displayName),
    role,
    roles: roles.length ? roles : [role],
    permissions: [...new Set(roles.flatMap((item) => rolePermissions[item]))],
    preferences: preferencesFor(me),
  };
}

function preferencesFor(me: SuperAdminMe): { locale: AppLocale; timezone: AppTimezone } {
  return me.preferences ?? { locale: defaultLocale, timezone: timezones[0].timezone };
}

function backendApiBaseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_API_BASE_URL;
  const fallback = "http://localhost:4000/api/v1";
  return stripTrailingSlash(!configured || configured === "https://api.example.com" ? fallback : configured);
}

function requiredServerEnv(name: "BACKEND_SUPABASE_URL" | "BACKEND_SUPABASE_ANON_KEY"): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required for Super Admin login.`);
  return value;
}

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

async function fetchWithTimeout(input: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), supabaseAuthTimeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "S") + (parts[1]?.[0] ?? "A")).toUpperCase();
}
