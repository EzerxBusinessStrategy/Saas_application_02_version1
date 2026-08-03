import { proxySuperAdminBackend } from "@/lib/server/super-admin-backend-proxy";

export async function PATCH(request: Request, { params }: { params: Promise<{ reviewId: string }> }) {
  const { reviewId } = await params;
  return proxySuperAdminBackend({
    path: `/super-admin/tenant-reviews/${encodeURIComponent(reviewId)}`,
    init: {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: await request.text(),
    },
    unauthenticatedMessage: "Sign in to update reviews.",
    unavailableMessage: "Backend review service is unavailable.",
  });
}
