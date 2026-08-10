import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import { FastifyReply, FastifyRequest } from "fastify";
import { Observable, catchError, tap, throwError } from "rxjs";

const SLOW_REQUEST_MS = 500;

@Injectable()
export class RequestPerformanceInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== "http") return next.handle();

    const http = context.switchToHttp();
    const request = http.getRequest<FastifyRequest>();
    const reply = http.getResponse<FastifyReply>();
    const startedAt = performance.now();
    const route = request.routeOptions?.url ?? "<unmatched>";
    const method = request.method;
    let logged = false;

    const logCompletion = (statusCode: number) => {
      if (logged) return;
      logged = true;
      const durationMs = Math.round(performance.now() - startedAt);
      reply.header("server-timing", `api;dur=${durationMs}`);
      const message = `[Performance] ${method} ${route} finished with ${statusCode} in ${durationMs}ms. Request ID: ${request.id}.`;
      if (durationMs >= SLOW_REQUEST_MS) request.log.warn(message);
      else request.log.debug(message);
    };

    return next.handle().pipe(
      tap(() => logCompletion(reply.statusCode)),
      catchError((error: unknown) => {
        const statusCode = typeof (error as { getStatus?: unknown }).getStatus === "function"
          ? (error as { getStatus: () => number }).getStatus()
          : reply.statusCode >= 400 ? reply.statusCode : 500;
        logCompletion(statusCode);
        return throwError(() => error);
      }),
    );
  }
}
