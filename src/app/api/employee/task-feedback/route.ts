import { proxyEmployeeBackend } from "@/lib/server/employee-backend-proxy";

export async function GET() {
  return proxyEmployeeBackend({
    path: "/employee/task-feedback",
    unavailableMessage: "Employee feedback log unavailable.",
  });
}
