import { CanActivate, ExecutionContext, Inject, Injectable } from "@nestjs/common";
import { FastifyRequest } from "fastify";
import { REQUEST_ID_HEADER, resolveRequestId } from "../../common/request-id/request-id";
import { authenticationRequired } from "../auth-errors";
import { AuthenticatedRequest } from "../request-context";
import { portalSessionCookieName } from "../auth-cookie-names";
import { PortalAuthService } from "../core/portal-auth.service";
import { portalFromHeader } from "../core/portal-auth.types";

@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  constructor(
    @Inject(PortalAuthService) private readonly auth: PortalAuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<FastifyRequest & AuthenticatedRequest>();
    const portalType = portalFromHeader(singleHeader(request.headers["x-portal"]));
    const token = portalType ? sessionTokenFromCookie(request.headers.cookie, portalType) : undefined;
    if (!token) throw authenticationRequired();
    const session = await this.auth.resolveSession(portalType!, token);
    request.verifiedAuthUser = {
      authUserId: session.user_id,
      sessionId: session.id,
      issuer: "portal-session",
      audience: ["portal-session"],
      expiresAt: session.expires_at,
      portalType: session.portal_type,
    };
    resolveRequestId(request.headers[REQUEST_ID_HEADER], request.id);
    return true;
  }
}

function singleHeader(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function sessionTokenFromCookie(cookie: string | undefined, portal: NonNullable<ReturnType<typeof portalFromHeader>>): string | undefined {
  const name = portalSessionCookieName(portal);
  for (const part of cookie?.split(";") ?? []) {
    const [key, ...value] = part.trim().split("=");
    if (key === name && value.length) return decodeURIComponent(value.join("="));
  }
  return undefined;
}
