import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

describe("EmployeeDocumentsRepository recipient notifications", () => {
  test("casts notification UUID parameters before using them in JSON metadata", () => {
    const source = readFileSync(resolve(__dirname, "../../src/platform/employee-documents.repository.ts"), "utf8");

    expect(source).toContain("$3::uuid,");
    expect(source).toContain("jsonb_build_object('documentId', $3::uuid, 'title', $4::text)");
    expect(source).toContain("tm.tenant_id = $1::uuid and tm.id = any($5::uuid[])");
    expect(source).toMatch(/on conflict \(idempotency_key\) where idempotency_key is not null\s+do update/);
  });

  test("lists documents shared with an employee even when no client is linked", () => {
    const source = readFileSync(resolve(__dirname, "../../src/platform/employee-documents.repository.ts"), "utf8");

    expect(source).toContain("left join public.clients c on c.id = d.client_id and c.tenant_id = d.tenant_id");
    expect(source).toContain("coalesce(c.display_name, 'Not linked')");
    expect(source).toContain("d.category <> 'invoice'");
  });
});
