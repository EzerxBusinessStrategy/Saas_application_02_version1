import { proxyEmployeeBackend } from "@/lib/server/employee-backend-proxy";

export async function GET() {
  return proxyEmployeeBackend({
    path: "/employee/tasks",
    unavailableMessage: "Employee tasks service unavailable.",
  });
}
