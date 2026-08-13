import { proxyPortalBackend } from "@/lib/server/portal-auth-gateway";
export { backendApiBaseUrl } from "@/lib/server/backend-api-url";
export function proxySuperAdminBackend(options: { path: string; init?: RequestInit; unauthenticatedMessage?: string; unavailableMessage?: string }) {
  return proxyPortalBackend("super-admin", { ...options, unauthenticatedMessage: options.unauthenticatedMessage ?? "Super Admin session required.", unavailableMessage: options.unavailableMessage ?? "Super Admin service unavailable." });
}
