import { proxyEmployeeBackend } from "@/lib/server/employee-backend-proxy";

export async function GET() {
  return proxyEmployeeBackend({
    path: "/employee/manager/reviews",
    unavailableMessage: "Task reviews unavailable.",
  });
}
