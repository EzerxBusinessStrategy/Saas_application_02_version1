import { CanActivate, ExecutionContext, Inject, Injectable } from "@nestjs/common";
import { FastifyRequest } from "fastify";
import { REQUEST_ID_HEADER, resolveRequestId } from "../../common/request-id/request-id";
import { authenticationRequired } from "../auth-errors";
import { AuthenticatedRequest } from "../request-context";
import { SupabaseJwtVerifier } from "../supabase-jwt-verifier.service";

@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  constructor(@Inject(SupabaseJwtVerifier) private readonly verifier: SupabaseJwtVerifier) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<FastifyRequest & AuthenticatedRequest>();
    const token = bearerTokenFromHeader(request.headers.authorization);
    if (!token) throw authenticationRequired();
    request.verifiedAuthUser = await this.verifier.verifyBearerToken(token);
    resolveRequestId(request.headers[REQUEST_ID_HEADER], request.id);
    return true;
  }
}

function bearerTokenFromHeader(header: string | undefined): string | undefined {
  if (!header) return undefined;
  const [scheme, token, extra] = header.trim().split(/\s+/);
  if (scheme !== "Bearer" || !token || extra) return undefined;
  return token;
}
