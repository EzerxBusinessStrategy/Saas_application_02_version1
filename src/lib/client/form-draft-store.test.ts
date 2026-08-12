import { afterEach, expect, test } from "vitest";
import {
  clearFormDraft,
  formDraftStorageKey,
  formDraftTtlMs,
  readFormDraft,
  writeFormDraft,
} from "@/lib/client/form-draft-store";

afterEach(() => window.localStorage.clear());

test("retains a form draft for four hours", () => {
  const now = 1_000_000;
  writeFormDraft("/admin/employees:create", [{ key: "field:name", value: "Asha Patel" }], now);

  expect(readFormDraft("/admin/employees:create", now + formDraftTtlMs - 1)).toMatchObject({
    fields: [{ key: "field:name", value: "Asha Patel" }],
  });
});

test("removes expired and explicitly cleared drafts", () => {
  const key = "/admin/employees:create";
  writeFormDraft(key, [{ key: "field:name", value: "Asha Patel" }], 1_000);

  expect(readFormDraft(key, 1_000 + formDraftTtlMs)).toBeNull();
  expect(window.localStorage.getItem(formDraftStorageKey(key))).toBeNull();

  writeFormDraft(key, [{ key: "field:name", value: "Asha Patel" }]);
  clearFormDraft(key);
  expect(readFormDraft(key)).toBeNull();
});
