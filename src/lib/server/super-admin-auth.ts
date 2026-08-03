import type { User } from "@/types/domain";
import { rolePermissions } from "@/lib/permissions";

type SupabasePasswordSession = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
};

type SuperAdminMe = {
  user: {
    email: string;
    displayName: string;
  };
  activeMembership: null | unknown;
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
  const response = await fetch(`${stripTrailingSlash(supabaseUrl)}/auth/v1/token?grant_type=password`, {
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
  const response = await fetch(`${stripTrailingSlash(supabaseUrl)}/auth/v1/token?grant_type=refresh_token`, {
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
  const response = await fetch(`${backendApiBaseUrl()}/auth/session-policy`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
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
  });
  if (!response.ok) return null;

  const me = (await response.json()) as SuperAdminMe;
  if (!me.isPlatformAdmin || !me.roles.includes("SUPER_ADMIN") || me.activeMembership !== null) {
    return null;
  }
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
  };
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

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "S") + (parts[1]?.[0] ?? "A")).toUpperCase();
}
