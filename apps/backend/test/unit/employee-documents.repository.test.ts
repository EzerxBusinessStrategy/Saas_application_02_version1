import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

describe("EmployeeDocumentsRepository recipient notifications", () => {
  test("casts notification UUID parameters before using them in JSON metadata", () => {
    const source = readFileSync(resolve(__dirname, "../../src/platform/employee-documents.repository.ts"), "utf8");

    expect(source).toContain("$3::uuid,");
    expect(source).toContain("jsonb_build_object('documentId', $3::uuid, 'title', $4::text)");
    expect(source).toContain("tm.tenant_id = $1::uuid and tm.id = any($5::uuid[])");
  });
});
