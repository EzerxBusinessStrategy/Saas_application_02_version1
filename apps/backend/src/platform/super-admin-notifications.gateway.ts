import { Inject } from "@nestjs/common";
import {
  OnGatewayConnection,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import { randomUUID } from "node:crypto";
import { Server, Socket } from "socket.io";
import { RequestContextResolver } from "../auth/request-context-resolver.service";
import { SessionPolicyRepository } from "../auth/session-policy.repository";
import { SupabaseJwtVerifier } from "../auth/supabase-jwt-verifier.service";
import { superAdminAccessTokenCookie } from "../auth/auth-cookie-names";
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
    @Inject(SupabaseJwtVerifier)
    private readonly verifier: SupabaseJwtVerifier,
    @Inject(RequestContextResolver)
    private readonly contextResolver: RequestContextResolver,
    @Inject(SessionPolicyRepository)
    private readonly sessionPolicies: SessionPolicyRepository,
    @Inject(SuperAdminNotificationsRepository)
    private readonly repository: SuperAdminNotificationsRepository,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    try {
      const token = tokenFromSocket(client);
      if (!token) {
        client.disconnect(true);
        return;
      }
      const verified = await this.verifier.verifyBearerToken(token);
      const resolved = await this.contextResolver.resolve(
        verified,
        { portal: "super-admin" },
        randomUUID(),
      );
      if (!resolved.context.isPlatformAdmin) {
        client.disconnect(true);
        return;
      }
      await this.sessionPolicies.assertActive(resolved.context, verified.sessionId);

      client.data.userId = resolved.context.userId;
      client.join(userRoom(resolved.context.userId));
      client.emit("notification:ready", { userId: resolved.context.userId });
      disconnectAtTokenExpiry(client, verified.expiresAt);
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

function userRoom(userId: string): string {
  return `user:${userId}`;
}
