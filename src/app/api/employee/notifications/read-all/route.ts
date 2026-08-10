import { proxyEmployeeBackend } from "@/lib/server/employee-backend-proxy";

export async function PATCH() {
  return proxyEmployeeBackend({
    path: "/employee/notifications/read-all",
    init: { method: "PATCH" },
    unavailableMessage: "Employee notifications service unavailable.",
  });
}
