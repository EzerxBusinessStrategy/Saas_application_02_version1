import { CanActivate, ExecutionContext, Inject, Injectable } from "@nestjs/common";
import { FastifyRequest } from "fastify";
import { REQUEST_ID_HEADER, resolveRequestId } from "../../common/request-id/request-id";
import { authenticationRequired } from "../auth-errors";
import { ActiveRequestContextService } from "../active-request-context.service";
import { AuthenticatedRequest } from "../request-context";
import { tenantSelectionFromRequest } from "../tenant-selection";

@Injectable()
export class ActiveRequestContextGuard implements CanActivate {
  constructor(
    @Inject(ActiveRequestContextService)
    private readonly activeContext: ActiveRequestContextService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<FastifyRequest & AuthenticatedRequest>();
    if (!request.verifiedAuthUser) throw authenticationRequired();
    const resolved = await this.activeContext.resolve(
      request.verifiedAuthUser,
      tenantSelectionFromRequest(request),
      resolveRequestId(request.headers[REQUEST_ID_HEADER], request.id),
    );
    request.requestContext = resolved.context;
    return true;
  }
}
