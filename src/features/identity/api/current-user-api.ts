import { useQuery } from "@tanstack/react-query";

export type CurrentUserPortal = "super-admin" | "tenant" | "employee" | "client";

export type CurrentUserProfile = {
  readonly user: {
    readonly displayName: string;
    readonly email: string;
    readonly avatarUrl?: string | null;
    readonly phone?: string | null;
  };
  readonly roles: readonly string[];
};

export const currentUserQueryKey = (portal: CurrentUserPortal) => ["me", portal] as const;

export async function fetchCurrentUser(portal: CurrentUserPortal): Promise<CurrentUserProfile> {
  const response = await fetch(`/api/me?portal=${portal}`, { cache: "no-store" });
  if (!response.ok) {
    throw new Error("Your profile could not be loaded.");
  }
  return (await response.json()) as CurrentUserProfile;
}

export type WorkspaceContext = {
  readonly type: "platform" | "tenant";
  readonly label?: string;
  readonly tenantId?: string;
  readonly tenantName?: string;
  readonly membershipId?: string;
  readonly roles: readonly string[];
  readonly displayTitle?: string | null;
  readonly hasEmployee?: boolean;
};

export async function fetchCurrentUserContexts(portal: CurrentUserPortal): Promise<readonly WorkspaceContext[]> {
  const response = await fetch(`/api/me/contexts?portal=${portal}`, { cache: "no-store" });
  if (!response.ok) {
    throw new Error("Your workspaces could not be loaded.");
  }
  const payload = (await response.json()) as { contexts?: readonly WorkspaceContext[] };
  return payload.contexts ?? [];
}

export async function switchWorkspace(
  portal: CurrentUserPortal,
  input: { workspace: "super-admin" | "admin" | "employee"; tenantId?: string },
): Promise<{ redirect: string }> {
  const response = await fetch(`/api/auth/switch-context?portal=${portal}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { message?: string; error?: { message?: string } } | null;
    throw new Error(payload?.error?.message ?? payload?.message ?? "That workspace could not be opened.");
  }
  return (await response.json()) as { redirect: string };
}

export async function uploadCurrentUserAvatar(
  portal: CurrentUserPortal,
  imageBase64: string,
): Promise<CurrentUserProfile> {
  const response = await fetch(`/api/me/avatar?portal=${portal}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ contentType: "image/webp", data: imageBase64 }),
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(payload?.message ?? "The profile photo could not be uploaded.");
  }
  return (await response.json()) as CurrentUserProfile;
}

export async function removeCurrentUserAvatar(portal: CurrentUserPortal): Promise<CurrentUserProfile> {
  const response = await fetch(`/api/me/avatar?portal=${portal}`, { method: "DELETE" });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(payload?.message ?? "The profile photo could not be removed.");
  }
  return (await response.json()) as CurrentUserProfile;
}

export function useCurrentUser(portal: CurrentUserPortal) {
  return useQuery({
    queryKey: currentUserQueryKey(portal),
    queryFn: () => fetchCurrentUser(portal),
  });
}
