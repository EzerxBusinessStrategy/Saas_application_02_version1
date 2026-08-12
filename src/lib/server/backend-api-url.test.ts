import { afterEach, describe, expect, it, vi } from "vitest";
import { backendApiBaseUrl } from "@/lib/server/backend-api-url";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("backendApiBaseUrl", () => {
  it("uses the Render API when production is missing its API URL", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "");

    expect(backendApiBaseUrl()).toBe(
      "https://saas-application-02-version1-api.onrender.com/api/v1",
    );
  });

  it("does not let a localhost API value break the production frontend", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:4000/api/v1");

    expect(backendApiBaseUrl()).toBe(
      "https://saas-application-02-version1-api.onrender.com/api/v1",
    );
  });

  it("keeps the configured API URL in local development", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:4100/api/v1");

    expect(backendApiBaseUrl()).toBe("http://localhost:4100/api/v1");
  });
});
