import { redirectToLoginOnUnauthorized } from "@/lib/client/silent-auth-redirect";

export async function markPlatformAlertViewed(alertId: string): Promise<void> {
  const response = await fetch(`/api/super-admin/alerts/${alertId}/view`, { method: "PATCH" });
  await redirectToLoginOnUnauthorized(response);
  if (!response.ok) throw new Error("Alert could not be marked viewed.");
}

export async function createTenantReviewFromAlert(alertId: string): Promise<void> {
  const response = await fetch(`/api/super-admin/alerts/${alertId}/reviews`, { method: "POST" });
  await redirectToLoginOnUnauthorized(response);
  if (!response.ok) throw new Error("Review could not be created.");
}

export async function updateTenantReviewStatus(
  reviewId: string,
  status: "IN_PROGRESS" | "COMPLETED" | "CANCELLED",
  resolution?: string,
): Promise<void> {
  const response = await fetch(`/api/super-admin/tenant-reviews/${reviewId}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ status, resolution: resolution?.trim() || undefined }),
  });
  await redirectToLoginOnUnauthorized(response);
  if (!response.ok) throw new Error("Review could not be updated.");
}
