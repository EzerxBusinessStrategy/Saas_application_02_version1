import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "vitest";

test("client dashboard queries use the authenticated account's business client scope", () => {
  const source = readFileSync(resolve(__dirname, "../../src/platform/client-portal-dashboard.repository.ts"), "utf8");

  expect(source).toContain("resolveClientPortalScope");
  expect(source).toContain("context.clientId");
  expect(source).not.toContain("context.clientAccountId");
});
