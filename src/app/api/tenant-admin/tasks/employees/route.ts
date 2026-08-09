import { type NextRequest } from "next/server";
import { proxyTenantAdminBackend } from "@/lib/server/tenant-admin-backend-proxy";

export async function GET() {
  return proxyTenantAdminBackend({
    path: "/tenant-admin/tasks/employees",
    unavailableMessage: "Employees unavailable.",
  });
}

export async function POST(request: NextRequest) {
  return proxyTenantAdminBackend({
    path: "/tenant-admin/tasks/employees",
    init: {
      method: "POST",
      body: await request.text(),
      headers: {
        "content-type": request.headers.get("content-type") ?? "application/json",
      },
    },
    unavailableMessage: "Employee could not be created.",
  });
}
