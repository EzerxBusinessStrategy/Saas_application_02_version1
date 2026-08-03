import { proxyBackend } from "../backend";

export function PATCH(request: Request) {
  return proxyBackend(request, "/super-admin/notifications/read-all", { method: "PATCH" });
}
