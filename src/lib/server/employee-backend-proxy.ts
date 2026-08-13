import { proxyPortalBackend } from "@/lib/server/portal-auth-gateway";
export function proxyEmployeeBackend(options: { path: string; init?: RequestInit; unauthenticatedMessage?: string; unavailableMessage?: string }) {
  return proxyPortalBackend("employee", { ...options, unauthenticatedMessage: options.unauthenticatedMessage ?? "Employee session required.", unavailableMessage: options.unavailableMessage ?? "Employee service unavailable." });
}
