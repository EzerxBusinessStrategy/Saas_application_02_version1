import { proxyBackend } from "./backend";

export function GET(request: Request) {
  return proxyBackend(request, `/super-admin/notifications${new URL(request.url).search}`);
}
