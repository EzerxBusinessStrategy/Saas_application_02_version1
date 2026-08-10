import { proxyEmployeeBackend } from "@/lib/server/employee-backend-proxy";

export async function GET() {
  return proxyEmployeeBackend({
    path: "/employee/documents/options",
    unavailableMessage: "Employee document options service unavailable.",
  });
}
