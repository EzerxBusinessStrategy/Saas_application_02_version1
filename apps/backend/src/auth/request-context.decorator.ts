import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { FastifyRequest } from "fastify";
import { AuthenticatedRequest, RequestContext } from "./request-context";

export const CurrentRequestContext = createParamDecorator(
  (_data: unknown, context: ExecutionContext): RequestContext => {
    const request = context.switchToHttp().getRequest<FastifyRequest & AuthenticatedRequest>();
    if (!request.requestContext) {
      throw new Error("RequestContext has not been resolved.");
    }
    return request.requestContext;
  },
);
