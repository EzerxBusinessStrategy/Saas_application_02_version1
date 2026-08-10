import { type NextRequest } from "next/server";
import { proxyEmployeeBackend } from "@/lib/server/employee-backend-proxy";

export async function POST(request: NextRequest) {
  return proxyEmployeeBackend({
    path: "/employee/manager/tasks",
    init: {
      method: "POST",
      body: await request.text(),
      headers: { "content-type": request.headers.get("content-type") ?? "application/json" },
    },
    unavailableMessage: "Task could not be assigned.",
  });
}
