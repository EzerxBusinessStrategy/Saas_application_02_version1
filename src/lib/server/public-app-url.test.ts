import { afterEach, describe, expect, it } from "vitest";
import { publicRedirectUrl } from "@/lib/server/public-app-url";

const originalPublicAppUrl = process.env.BACKEND_PUBLIC_APP_URL;

afterEach(() => {
  if (originalPublicAppUrl === undefined) {
    delete process.env.BACKEND_PUBLIC_APP_URL;
  } else {
    process.env.BACKEND_PUBLIC_APP_URL = originalPublicAppUrl;
  }
});

describe("publicRedirectUrl", () => {
  it("uses the configured public origin behind a reverse proxy", () => {
    process.env.BACKEND_PUBLIC_APP_URL = "https://saas.example.com";
    expect(
      publicRedirectUrl("http://localhost:10000/api/auth/tenant/login", "/login").href,
    ).toBe("https://saas.example.com/login");
  });

  it("uses the request origin for local development", () => {
    delete process.env.BACKEND_PUBLIC_APP_URL;
    expect(publicRedirectUrl("http://localhost:3000/api/auth/tenant/login", "/login").href).toBe(
      "http://localhost:3000/login",
    );
  });

  it("rejects non-http configured origins", () => {
    process.env.BACKEND_PUBLIC_APP_URL = "javascript:alert(1)";
    expect(() => publicRedirectUrl("http://localhost:3000", "/login")).toThrow(
      "BACKEND_PUBLIC_APP_URL must use http or https.",
    );
  });
});
