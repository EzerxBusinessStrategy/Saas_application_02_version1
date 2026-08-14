import { type NextRequest } from "next/server";
import { proxyEmployeeBackend } from "@/lib/server/employee-backend-proxy";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ taskId: string }> },
) {
  const { taskId } = await params;
  return proxyEmployeeBackend({
    path: `/employee/manager/reviews/${encodeURIComponent(taskId)}`,
    unavailableMessage: "Task review details are unavailable.",
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> },
) {
  const { taskId } = await params;
  return proxyEmployeeBackend({
    path: `/employee/manager/reviews/${encodeURIComponent(taskId)}`,
    init: {
      method: "POST",
      body: await request.text(),
      headers: { "content-type": request.headers.get("content-type") ?? "application/json" },
    },
    unavailableMessage: "Review decision could not be saved.",
  });
}
