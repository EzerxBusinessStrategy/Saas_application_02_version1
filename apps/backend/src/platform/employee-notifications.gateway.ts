import { Inject, Logger } from "@nestjs/common";
import { OnGatewayConnection, OnGatewayDisconnect, WebSocketGateway, WebSocketServer } from "@nestjs/websockets";
import { randomUUID } from "node:crypto";
import { Server, Socket } from "socket.io";
import { superAdminAccessTokenCookie } from "../auth/auth-cookie-names";
import { ActiveRequestContextService } from "../auth/active-request-context.service";
import { SupabaseJwtVerifier } from "../auth/supabase-jwt-verifier.service";
import { requireEmployeeContext } from "./employee-context";
import { NotificationItemDto } from "./super-admin-notifications.dto";

@WebSocketGateway({
  namespace: "/employee/notifications",
  cors: { origin: true, credentials: true },
})
export class EmployeeNotificationsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(EmployeeNotificationsGateway.name);
  @WebSocketServer()
  private server?: Server;

  constructor(
    @Inject(SupabaseJwtVerifier) private readonly verifier: SupabaseJwtVerifier,
    @Inject(ActiveRequestContextService) private readonly activeContext: ActiveRequestContextService,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    try {
      const token = tokenFromSocket(client);
      if (!token) {
        client.disconnect(true);
        return;
      }
      const verified = await this.verifier.verifyBearerToken(token);
      const resolved = await this.activeContext.resolve(verified, { portal: "employee" }, randomUUID());
      const employeeContext = requireEmployeeContext(resolved.context);
      client.join(employeeRoom(employeeContext.tenantId, employeeContext.userId));
      client.emit("notification:ready", { userId: employeeContext.userId, tenantId: employeeContext.tenantId });
      disconnectAtTokenExpiry(client, verified.expiresAt);
      this.logger.log(`[Socket.IO] Employee notification connection is ready. Socket: ${client.id}.`);
    } catch {
      this.logger.warn("[Socket.IO] Employee notification connection was rejected because the active employee session could not be verified.");
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket): void {
    this.logger.log(`[Socket.IO] Employee notification connection closed. Socket: ${client.id}.`);
  }

  emitNewNotification(userId: string, tenantId: string, item: NotificationItemDto): number {
    const room = employeeRoom(tenantId, userId);
    const connectedSockets = this.server?.sockets.adapter.rooms.get(room)?.size ?? 0;
    this.server?.to(room).emit("notification:new", item);
    return connectedSockets;
  }
}

function employeeRoom(tenantId: string, userId: string): string {
  return `tenant:${tenantId}:user:${userId}`;
}

function disconnectAtTokenExpiry(client: Socket, expiresAt: Date): void {
  const timeout = setTimeout(() => client.disconnect(true), Math.max(0, expiresAt.getTime() - Date.now()));
  client.on("disconnect", () => clearTimeout(timeout));
}

function tokenFromSocket(client: Socket): string | undefined {
  const authToken = client.handshake.auth?.token;
  if (typeof authToken === "string" && authToken.trim()) return authToken.trim();
  const authorization = client.handshake.headers.authorization;
  if (authorization?.startsWith("Bearer ")) return authorization.slice("Bearer ".length).trim();
  const cookie = client.handshake.headers.cookie;
  if (!cookie) return undefined;
  for (const pair of cookie.split(";")) {
    const [key, ...value] = pair.trim().split("=");
    if (key === superAdminAccessTokenCookie) return decodeURIComponent(value.join("="));
  }
  return undefined;
}
