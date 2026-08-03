import { FastifyCorsOptions } from "@fastify/cors";
import { AppConfig } from "../../config/app-config";

export function createCorsOptions(config: AppConfig): FastifyCorsOptions {
  return {
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["authorization", "content-type", "x-request-id", "idempotency-key"],
    exposedHeaders: ["x-request-id"],
    origin(origin, callback) {
      if (!origin) {
        callback(null, true);
        return;
      }
      callback(null, config.corsOrigins.includes(origin));
    },
  };
}
