import { Module } from "@nestjs/common";
import { RequestContextService } from "./request-id/request-context.service";
import { RequestIdInterceptor } from "./request-id/request-id.interceptor";

@Module({
  providers: [RequestContextService, RequestIdInterceptor],
  exports: [RequestContextService, RequestIdInterceptor],
})
export class CommonModule {}
