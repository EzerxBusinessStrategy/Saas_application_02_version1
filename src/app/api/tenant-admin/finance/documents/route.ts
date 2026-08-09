import { type NextRequest } from "next/server";
import { proxyTenantAdminBackend } from "@/lib/server/tenant-admin-backend-proxy";

export async function GET(request: NextRequest) {
  const query = new URL(request.url).searchParams.toString();
  return proxyTenantAdminBackend({
    path: query ? `/tenant-admin/finance/documents?${query}` : "/tenant-admin/finance/documents",
    unavailableMessage: "Documents unavailable.",
  });
}

export async function POST(request: NextRequest) {
  return proxyTenantAdminBackend({
    path: "/tenant-admin/finance/documents",
    init: {
      method: "POST",
      body: await request.text(),
      headers: { "content-type": request.headers.get("content-type") ?? "application/json" },
    },
    unavailableMessage: "Document could not be created.",
  });
}
