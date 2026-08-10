import { proxyEmployeeBackend } from "@/lib/server/employee-backend-proxy";

export async function GET() {
  return proxyEmployeeBackend({
    path: "/employee/dashboard",
    unavailableMessage: "Employee dashboard service unavailable.",
  });
}
