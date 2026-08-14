import { Inject } from "@nestjs/common";
import {
  OnGatewayConnection,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import { randomUUID } from "node:crypto";
import { Namespace, Socket } from "socket.io";
import { ActiveRequestContextService } from "../auth/active-request-context.service";
import { tenantSessionCookie } from "../auth/auth-cookie-names";
import { PortalAuthService } from "../auth/core/portal-auth.service";
import { NotificationItemDto } from "./super-admin-notifications.dto";
import { requireTenantAdminContext } from "./tenant-admin-context";
import { TenantAdminNotificationsRepository } from "./tenant-admin-notifications.repository";

@WebSocketGateway({
  namespace: "/tenant-admin/notifications",
  cors: { origin: true, credentials: true },
})
export class TenantAdminNotificationsGateway implements OnGatewayConnection {
  @WebSocketServer()
  private server?: Namespace;

  constructor(
    @Inject(PortalAuthService)
    private readonly auth: PortalAuthService,
    @Inject(ActiveRequestContextService)
    private readonly activeContext: ActiveRequestContextService,
    @Inject(TenantAdminNotificationsRepository)
    private readonly repository: TenantAdminNotificationsRepository,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    try {
      const token = cookieValue(client.handshake.headers.cookie, tenantSessionCookie);
      if (!token) {
        client.disconnect(true);
        return;
      }
      const session = await this.auth.resolveSession("TENANT", token);
      const verified = portalVerifiedUser(session);
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
      disconnectAtTokenExpiry(client, session.idle_expires_at ?? session.expires_at);
    } catch {
      client.disconnect(true);
    }
  }

  emitNewNotification(userId: string, tenantId: string, item: NotificationItemDto): number {
    const room = tenantUserRoom(tenantId, userId);
    const connectedSockets = this.server?.adapter.rooms.get(room)?.size ?? 0;
    this.server?.to(room).emit("notification:new", item);
    void this.repository.markDelivered(userId, item.id);
    return connectedSockets;
  }
}

function disconnectAtTokenExpiry(client: Socket, expiresAt: Date): void {
  const timeout = setTimeout(() => client.disconnect(true), Math.max(0, expiresAt.getTime() - Date.now()));
  client.on("disconnect", () => clearTimeout(timeout));
}

function cookieValue(header: string | undefined, name: string): string | undefined {
  if (!header) return undefined;
  for (const pair of header.split(";")) {
    const [rawKey, ...rawValue] = pair.trim().split("=");
    if (rawKey === name) return decodeURIComponent(rawValue.join("="));
  }
  return undefined;
}

function portalVerifiedUser(session: Awaited<ReturnType<PortalAuthService["resolveSession"]>>) {
  return { authUserId: session.user_id, sessionId: session.id, issuer: "portal-session", audience: ["portal-session"], expiresAt: session.expires_at, portalType: session.portal_type } as const;
}

function tenantUserRoom(tenantId: string, userId: string): string {
  return `tenant:${tenantId}:user:${userId}`;
}
