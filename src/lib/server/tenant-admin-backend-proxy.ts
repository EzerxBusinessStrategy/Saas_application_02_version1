import { proxyPortalBackend } from "@/lib/server/portal-auth-gateway";
export function proxyTenantAdminBackend(options: { path: string; init?: RequestInit; unauthenticatedMessage?: string; unavailableMessage?: string }) {
  return proxyPortalBackend("tenant", { ...options, unauthenticatedMessage: options.unauthenticatedMessage ?? "Tenant Admin session required.", unavailableMessage: options.unavailableMessage ?? "Tenant Admin service unavailable." });
}
