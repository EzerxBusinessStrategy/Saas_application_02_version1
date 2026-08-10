import { NextRequest } from "next/server";
import { proxyEmployeeBackend } from "@/lib/server/employee-backend-proxy";

export async function GET() {
  return proxyEmployeeBackend({
    path: "/employee/documents",
    unavailableMessage: "Employee documents service unavailable.",
  });
}

export async function POST(request: NextRequest) {
  return proxyEmployeeBackend({
    path: "/employee/documents",
    init: {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(await request.json()),
    },
    unavailableMessage: "Employee documents service unavailable.",
  });
}
