import request from "supertest";
import { afterEach, describe, expect, test } from "vitest";
import { NestFastifyApplication } from "@nestjs/platform-fastify";
import { createTestApp } from "../helpers/test-app";

describe("backend foundation API", () => {
  let app: NestFastifyApplication | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  test("liveness responds with a request ID", async () => {
    app = await createTestApp();

    const response = await request(app.getHttpServer()).get("/api/v1/health/live").expect(200);

    expect(response.headers["x-request-id"]).toEqual(expect.any(String));
    expect(response.body).toMatchObject({
      status: "ok",
      service: "SaaS App Backend",
    });
  });

  test("readiness reports only real foundation checks", async () => {
    app = await createTestApp();

    const response = await request(app.getHttpServer()).get("/api/v1/health/ready").expect(200);

    expect(response.body).toMatchObject({
      status: "ready",
      checks: [{ name: "configuration", status: "up" }],
      dependencies: [{ name: "database", status: "not_configured" }],
    });
  });

  test("returns a safe inbound request ID", async () => {
    app = await createTestApp();

    const response = await request(app.getHttpServer())
      .get("/api/v1/health/live")
      .set("x-request-id", "req-20260728-abc123")
      .expect(200);

    expect(response.headers["x-request-id"]).toBe("req-20260728-abc123");
  });

  test("replaces an unsafe inbound request ID", async () => {
    app = await createTestApp();

    const response = await request(app.getHttpServer())
      .get("/api/v1/health/live")
      .set("x-request-id", "../not-safe")
      .expect(200);

    expect(response.headers["x-request-id"]).not.toBe("../not-safe");
    expect(response.headers["x-request-id"]).toEqual(expect.any(String));
  });

  test("does not expose stack traces in error envelopes", async () => {
    app = await createTestApp();

    const response = await request(app.getHttpServer()).get("/api/v1/missing").expect(404);

    expect(response.body).toMatchObject({
      error: {
        code: "NOT_FOUND",
        message: expect.any(String),
        requestId: expect.any(String),
      },
    });
    expect(JSON.stringify(response.body)).not.toContain("stack");
  });

  test("allows configured CORS origins without using a wildcard", async () => {
    app = await createTestApp();

    const response = await request(app.getHttpServer())
      .get("/api/v1/health/live")
      .set("origin", "https://app.example.com")
      .expect(200);

    expect(response.headers["access-control-allow-origin"]).toBe("https://app.example.com");
  });

  test("does not reflect unconfigured CORS origins", async () => {
    app = await createTestApp();

    const response = await request(app.getHttpServer())
      .get("/api/v1/health/live")
      .set("origin", "https://evil.example.com")
      .expect(200);

    expect(response.headers["access-control-allow-origin"]).toBeUndefined();
  });

  test("generates OpenAPI for foundation endpoints", async () => {
    app = await createTestApp();

    const response = await request(app.getHttpServer()).get("/api/v1/docs-json").expect(200);

    expect(response.body).toMatchObject({
      openapi: expect.stringMatching(/^3\./),
      info: { title: "SaaS App Backend" },
    });
    expect(response.body.paths).toHaveProperty("/api/v1/health/live");
    expect(response.body.paths).toHaveProperty("/api/v1/health/ready");
  });
});
