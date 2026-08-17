import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

describe("client portal notification idempotency", () => {
  test.each([
    "client-portal-requests.repository.ts",
    "client-portal-deliverables.repository.ts",
    "client-portal-service-comments.repository.ts",
  ])("matches the partial notification idempotency index in %s", (fileName) => {
    const source = readFileSync(resolve(__dirname, `../../src/platform/${fileName}`), "utf8");

    expect(source).toContain("on conflict (idempotency_key) where idempotency_key is not null do nothing");
  });
});
