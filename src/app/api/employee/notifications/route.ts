import { NextRequest } from "next/server";
import { proxyEmployeeBackend } from "@/lib/server/employee-backend-proxy";

export async function GET(request: NextRequest) {
  return proxyEmployeeBackend({
    path: `/employee/notifications${request.nextUrl.search}`,
    unavailableMessage: "Employee notifications service unavailable.",
  });
}
