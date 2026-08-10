import { proxyEmployeeBackend } from "@/lib/server/employee-backend-proxy";

export async function GET() {
  return proxyEmployeeBackend({
    path: "/employee/work-logs",
    unavailableMessage: "Employee work logs service unavailable.",
  });
}
