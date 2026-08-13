import { Inject } from "@nestjs/common";
import {
  OnGatewayConnection,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import { randomUUID } from "node:crypto";
import { Server, Socket } from "socket.io";
import { ActiveRequestContextService } from "../auth/active-request-context.service";
import { superAdminSessionCookie } from "../auth/auth-cookie-names";
import { PortalAuthService } from "../auth/core/portal-auth.service";
import { NotificationItemDto } from "./super-admin-notifications.dto";
import { SuperAdminNotificationsRepository } from "./super-admin-notifications.repository";

@WebSocketGateway({
  namespace: "/super-admin/notifications",
  cors: { origin: true, credentials: true },
})
export class SuperAdminNotificationsGateway implements OnGatewayConnection {
  @WebSocketServer()
  private server?: Server;

  constructor(
    @Inject(PortalAuthService)
    private readonly auth: PortalAuthService,
    @Inject(ActiveRequestContextService)
    private readonly activeContext: ActiveRequestContextService,
    @Inject(SuperAdminNotificationsRepository)
    private readonly repository: SuperAdminNotificationsRepository,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    try {
      const token = cookieValue(client.handshake.headers.cookie, superAdminSessionCookie);
      if (!token) {
        client.disconnect(true);
        return;
      }
      const session = await this.auth.resolveSession("SUPER_ADMIN", token);
      const verified = portalVerifiedUser(session);
      const resolved = await this.activeContext.resolve(
        verified,
        { portal: "super-admin" },
        randomUUID(),
      );
      if (!resolved.context.isPlatformAdmin) {
        client.disconnect(true);
        return;
      }
      client.data.userId = resolved.context.userId;
      client.join(userRoom(resolved.context.userId));
      client.emit("notification:ready", { userId: resolved.context.userId });
      disconnectAtTokenExpiry(client, session.idle_expires_at ?? session.expires_at);
    } catch {
      client.disconnect(true);
    }
  }

  emitNewNotification(userId: string, item: NotificationItemDto): void {
    this.server?.to(userRoom(userId)).emit("notification:new", item);
    void this.repository.markDelivered(userId, item.id);
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

function userRoom(userId: string): string {
  return `user:${userId}`;
}
