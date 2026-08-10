import { proxyEmployeeBackend } from "@/lib/server/employee-backend-proxy";

export async function GET() {
  return proxyEmployeeBackend({
    path: "/employee/manager/task-options",
    unavailableMessage: "Manager task options unavailable.",
  });
}
