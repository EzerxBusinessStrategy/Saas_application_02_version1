import { CanActivate, ExecutionContext, Inject, Injectable } from "@nestjs/common";
import { FastifyRequest } from "fastify";
import { REQUEST_ID_HEADER, resolveRequestId } from "../../common/request-id/request-id";
import { authenticationRequired } from "../auth-errors";
import { AuthenticatedRequest } from "../request-context";
import { RequestContextResolver } from "../request-context-resolver.service";
import { SessionPolicyRepository } from "../session-policy.repository";
import { tenantSelectionFromRequest } from "../tenant-selection";

@Injectable()
export class ActiveRequestContextGuard implements CanActivate {
  constructor(
    @Inject(RequestContextResolver) private readonly resolver: RequestContextResolver,
    @Inject(SessionPolicyRepository) private readonly sessionPolicies: SessionPolicyRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<FastifyRequest & AuthenticatedRequest>();
    if (!request.verifiedAuthUser) throw authenticationRequired();
    const resolved = await this.resolver.resolve(
      request.verifiedAuthUser,
      tenantSelectionFromRequest(request),
      resolveRequestId(request.headers[REQUEST_ID_HEADER], request.id),
    );
    await this.sessionPolicies.assertActive(resolved.context, request.verifiedAuthUser.sessionId);
    request.requestContext = resolved.context;
    return true;
  }
}
