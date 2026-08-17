import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, NestFastifyApplication } from "@nestjs/platform-fastify";
import { IoAdapter } from "@nestjs/platform-socket.io";
import helmet from "@fastify/helmet";
import { IncomingMessage } from "node:http";
import { AppModule } from "./app.module";
import { AppConfig } from "./config/app-config";
import { createCorsOptions } from "./common/http/cors-options";
import { REQUEST_ID_HEADER, resolveRequestId } from "./common/request-id/request-id";
import { createFastifyLoggerOptions } from "./common/logging/pino-options";
import { setupOpenApi } from "./openapi";

export async function createBackendApp(config: AppConfig): Promise<NestFastifyApplication> {
  const adapter = new FastifyAdapter({
    bodyLimit: config.requestBodyLimitBytes,
    trustProxy: config.trustProxy,
    genReqId: (request: IncomingMessage) => resolveRequestId(request.headers[REQUEST_ID_HEADER]),
    logger: createFastifyLoggerOptions(config),
  });
  const app = await NestFactory.create<NestFastifyApplication>(AppModule.forRoot(config), adapter, {
    bufferLogs: true,
    logger: config.logLevel === "silent" ? false : ["error", "warn", "log"],
  });

  await app.register(helmet, {
    contentSecurityPolicy: false,
  });

  app.enableCors(createCorsOptions(config));
  app.useWebSocketAdapter(new IoAdapter(app));
  app.setGlobalPrefix(config.apiBasePath.replace(/^\//, ""));
  app.enableShutdownHooks();
  setupOpenApi(app, config);

  return app;
}
