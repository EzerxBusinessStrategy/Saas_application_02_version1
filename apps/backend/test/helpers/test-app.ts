import { NestFastifyApplication } from "@nestjs/platform-fastify";
import { createBackendApp } from "../../src/bootstrap";
import { AppConfig } from "../../src/config/app-config";

export const testConfig: AppConfig = {
  environment: "test",
  appName: "SaaS App Backend",
  port: 0,
  logLevel: "silent",
  apiBasePath: "/api/v1",
  corsOrigins: ["https://app.example.com"],
  publicAppUrl: "https://app.example.com",
  requestBodyLimitBytes: 1024 * 1024,
  trustProxy: false,
  databasePoolMax: 2,
  supabaseJwksTimeoutMs: 1500,
};

export async function createTestApp(config: AppConfig = testConfig): Promise<NestFastifyApplication> {
  const app = await createBackendApp(config);
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
  return app;
}
