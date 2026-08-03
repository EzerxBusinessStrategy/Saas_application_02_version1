import { CallHandler, ExecutionContext, Inject, Injectable, NestInterceptor } from "@nestjs/common";
import { FastifyReply, FastifyRequest } from "fastify";
import { Observable } from "rxjs";
import { REQUEST_ID_HEADER, resolveRequestId } from "./request-id";
import { RequestContextService } from "./request-context.service";

@Injectable()
export class RequestIdInterceptor implements NestInterceptor {
  constructor(@Inject(RequestContextService) private readonly requestContext: RequestContextService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<FastifyRequest>();
    const reply = http.getResponse<FastifyReply>();
    const requestId = resolveRequestId(request.headers[REQUEST_ID_HEADER], request.id);

    reply.header(REQUEST_ID_HEADER, requestId);

    return this.requestContext.run({ requestId }, () => next.handle());
  }
}
