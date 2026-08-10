import { proxyEmployeeBackend } from "@/lib/server/employee-backend-proxy";

export async function GET() {
  return proxyEmployeeBackend({
    path: "/employee/profile",
    unavailableMessage: "Employee profile service unavailable.",
  });
}
