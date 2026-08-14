import { type NextRequest } from "next/server";
import { proxyEmployeeBackend } from "@/lib/server/employee-backend-proxy";

export async function POST(request: NextRequest) {
  return proxyEmployeeBackend({
    path: "/employee/documents/upload-url",
    init: { method: "POST", body: await request.text(), headers: { "content-type": "application/json" } },
    unavailableMessage: "Document storage is unavailable.",
  });
}
