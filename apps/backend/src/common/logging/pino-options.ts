import { FastifyServerOptions } from "fastify";
import { AppConfig } from "../../config/app-config";

const REDACT_PATHS = [
  "req.headers.authorization",
  "req.headers.cookie",
  "req.headers['set-cookie']",
  "req.headers['x-api-key']",
  "res.headers['set-cookie']",
  "password",
  "accessToken",
  "refreshToken",
  "databaseUrl",
  "supabaseAnonKey",
  "*.password",
  "*.accessToken",
  "*.refreshToken",
  "*.authorization",
  "*.cookie",
  "*.signedUrl",
];

export function createFastifyLoggerOptions(config: AppConfig): FastifyServerOptions["logger"] {
  return {
    level: config.logLevel,
    base: {
      service: config.appName,
      environment: config.environment,
    },
    redact: {
      paths: REDACT_PATHS,
      censor: "[REDACTED]",
    },
    serializers: {
      req(request) {
        return {
          id: request.id,
          method: request.method,
          url: request.url,
          route: request.routeOptions?.url,
        };
      },
      res(reply) {
        return {
          statusCode: reply.statusCode,
        };
      },
    },
  };
}
