import { describe, expect, test } from "vitest";
import { ConfigValidationError, loadAppConfig } from "../../src/config/app-config";

describe("loadAppConfig", () => {
  test("loads a valid test configuration", () => {
    const config = loadAppConfig({
      NODE_ENV: "test",
      BACKEND_APP_NAME: "SaaS App Backend",
      BACKEND_PORT: "4100",
      BACKEND_LOG_LEVEL: "debug",
      BACKEND_API_BASE_PATH: "/api/v1",
      BACKEND_CORS_ORIGINS: "https://app.example.com",
      BACKEND_PUBLIC_APP_URL: "https://app.example.com",
      BACKEND_REQUEST_BODY_LIMIT_BYTES: "2048",
    });

    expect(config).toMatchObject({
      environment: "test",
      appName: "SaaS App Backend",
      port: 4100,
      logLevel: "debug",
      apiBasePath: "/api/v1",
      corsOrigins: ["https://app.example.com"],
      publicAppUrl: "https://app.example.com",
      requestBodyLimitBytes: 2048,
      databasePoolMax: 5,
    });
  });

  test("fails production configuration without CORS origins and public URL", () => {
    expect(() =>
      loadAppConfig({
        NODE_ENV: "production",
        BACKEND_APP_NAME: "SaaS App Backend",
      }),
    ).toThrow(ConfigValidationError);
  });

  test("rejects wildcard CORS origins", () => {
    expect(() =>
      loadAppConfig({
        NODE_ENV: "test",
        BACKEND_CORS_ORIGINS: "*",
      }),
    ).toThrow(ConfigValidationError);
  });

  test("keeps later database and Supabase placeholders optional", () => {
    const config = loadAppConfig({
      NODE_ENV: "test",
      BACKEND_CORS_ORIGINS: "https://app.example.com",
      BACKEND_DATABASE_URL: "",
      BACKEND_DATABASE_MIGRATION_URL: "",
      BACKEND_DATABASE_POOL_MAX: "3",
      BACKEND_SUPABASE_URL: "",
      BACKEND_SUPABASE_ANON_KEY: "",
    });

    expect(config.databaseUrl).toBeUndefined();
    expect(config.databaseMigrationUrl).toBeUndefined();
    expect(config.databasePoolMax).toBe(3);
    expect(config.supabaseUrl).toBeUndefined();
    expect(config.supabaseAnonKey).toBeUndefined();
  });

  test("requires a database URL for staging and production", () => {
    expect(() =>
      loadAppConfig({
        NODE_ENV: "staging",
        BACKEND_CORS_ORIGINS: "https://app.example.com",
      }),
    ).toThrow(ConfigValidationError);
  });

  test("requires trusted proxy configuration for production audit IP addresses", () => {
    expect(() =>
      loadAppConfig({
        NODE_ENV: "production",
        BACKEND_CORS_ORIGINS: "https://app.example.com",
        BACKEND_PUBLIC_APP_URL: "https://app.example.com",
        BACKEND_DATABASE_URL: "postgresql://runtime:password@db.example.com:5432/app",
        BACKEND_TRUST_PROXY: "false",
      }),
    ).toThrow(ConfigValidationError);
  });
});
