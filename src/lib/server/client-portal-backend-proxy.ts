import { proxyPortalBackend } from "@/lib/server/portal-auth-gateway";
export function proxyClientPortalBackend(options: { path: string; init?: RequestInit; unauthenticatedMessage?: string; unavailableMessage?: string }) {
  return proxyPortalBackend("client", { ...options, unauthenticatedMessage: options.unauthenticatedMessage ?? "Client portal session required.", unavailableMessage: options.unavailableMessage ?? "Client portal service unavailable." });
}
