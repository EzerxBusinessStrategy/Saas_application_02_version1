import { CanActivate, ExecutionContext, Inject, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { FastifyRequest } from "fastify";
import { permissionDenied } from "../auth-errors";
import { REQUIRED_PERMISSIONS_KEY } from "../permissions.decorator";
import { AuthenticatedRequest } from "../request-context";

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(@Inject(Reflector) private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required =
      this.reflector.getAllAndOverride<readonly string[]>(REQUIRED_PERMISSIONS_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];
    if (required.length === 0) return true;
    const request = context.switchToHttp().getRequest<FastifyRequest & AuthenticatedRequest>();
    const permissions = request.requestContext?.permissions ?? [];
    if (required.every((permission) => permissions.includes(permission))) return true;
    throw permissionDenied();
  }
}
