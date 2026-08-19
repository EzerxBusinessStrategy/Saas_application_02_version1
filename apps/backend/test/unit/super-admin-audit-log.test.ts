import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("super admin audit log", () => {
  it("searches and displays enriched operational audit metadata", () => {
    const source = readFileSync(
      resolve(__dirname, "../../src/platform/super-admin-audit-log.repository.ts"),
      "utf8",
    );
    expect(source).toContain("ae.metadata::text ilike");
    expect(source).toContain("employeeName");
    expect(source).toContain("managerName");
    expect(source).toContain("clientName");
    expect(source).toContain("resourceLabel");
  });
});
