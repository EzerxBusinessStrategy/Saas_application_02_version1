import { Inject } from "@nestjs/common";
import {
  OnGatewayConnection,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import { randomUUID } from "node:crypto";
import { Server, Socket } from "socket.io";
import { ActiveRequestContextService } from "../auth/active-request-context.service";
import { SupabaseJwtVerifier } from "../auth/supabase-jwt-verifier.service";
import { superAdminAccessTokenCookie } from "../auth/auth-cookie-names";
import { NotificationItemDto } from "./super-admin-notifications.dto";
import { requireTenantAdminContext } from "./tenant-admin-context";
import { TenantAdminNotificationsRepository } from "./tenant-admin-notifications.repository";

@WebSocketGateway({
  namespace: "/tenant-admin/notifications",
  cors: { origin: true, credentials: true },
})
export class TenantAdminNotificationsGateway implements OnGatewayConnection {
  @WebSocketServer()
  private server?: Server;

  constructor(
    @Inject(SupabaseJwtVerifier)
    private readonly verifier: SupabaseJwtVerifier,
    @Inject(ActiveRequestContextService)
    private readonly activeContext: ActiveRequestContextService,
    @Inject(TenantAdminNotificationsRepository)
    private readonly repository: TenantAdminNotificationsRepository,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    try {
      const token = tokenFromSocket(client);
      if (!token) {
        client.disconnect(true);
        return;
      }
      const verified = await this.verifier.verifyBearerToken(token);
      const resolved = await this.activeContext.resolve(
        verified,
        { portal: "admin" },
        randomUUID(),
      );
      const tenantContext = requireTenantAdminContext(resolved.context);

      client.data.userId = tenantContext.userId;
      client.data.tenantId = tenantContext.tenantId;
      client.join(tenantUserRoom(tenantContext.tenantId, tenantContext.userId));
      client.emit("notification:ready", { userId: tenantContext.userId, tenantId: tenantContext.tenantId });
      disconnectAtTokenExpiry(client, verified.expiresAt);
    } catch {
      client.disconnect(true);
    }
  }

  emitNewNotification(userId: string, tenantId: string, item: NotificationItemDto): number {
    const room = tenantUserRoom(tenantId, userId);
    const connectedSockets = this.server?.sockets.adapter.rooms.get(room)?.size ?? 0;
    this.server?.to(room).emit("notification:new", item);
    void this.repository.markDelivered(userId, item.id);
    return connectedSockets;
  }
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
  return cookieValue(client.handshake.headers.cookie, superAdminAccessTokenCookie);
}

function cookieValue(header: string | undefined, name: string): string | undefined {
  if (!header) return undefined;
  for (const pair of header.split(";")) {
    const [rawKey, ...rawValue] = pair.trim().split("=");
    if (rawKey === name) return decodeURIComponent(rawValue.join("="));
  }
  return undefined;
}

function tenantUserRoom(tenantId: string, userId: string): string {
  return `tenant:${tenantId}:user:${userId}`;
}
