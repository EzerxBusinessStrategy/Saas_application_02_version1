export const formDraftTtlMs = 4 * 60 * 60 * 1_000;
export const formDraftStoragePrefix = "saas-form-draft:v1:";

export type StoredFormField = {
  key: string;
  value: string;
  checked?: boolean;
};

export type StoredFormDraft = {
  expiresAt: number;
  fields: StoredFormField[];
};

export function formDraftStorageKey(formKey: string): string {
  return `${formDraftStoragePrefix}${formKey}`;
}

export function readFormDraft(formKey: string, now = Date.now()): StoredFormDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(formDraftStorageKey(formKey));
    if (!raw) return null;
    const draft = JSON.parse(raw) as StoredFormDraft;
    if (!isStoredFormDraft(draft) || draft.expiresAt <= now) {
      window.localStorage.removeItem(formDraftStorageKey(formKey));
      return null;
    }
    return draft;
  } catch {
    return null;
  }
}

export function writeFormDraft(
  formKey: string,
  fields: StoredFormField[],
  now = Date.now(),
): void {
  if (typeof window === "undefined") return;
  const storageKey = formDraftStorageKey(formKey);
  try {
    if (!fields.length) {
      window.localStorage.removeItem(storageKey);
      return;
    }
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({ expiresAt: now + formDraftTtlMs, fields } satisfies StoredFormDraft),
    );
  } catch {
    // Browser storage can be unavailable or full. Form entry must still work.
  }
}

export function clearFormDraft(formKey: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(formDraftStorageKey(formKey));
  } catch {
    // Ignore unavailable browser storage.
  }
}

function isStoredFormDraft(value: unknown): value is StoredFormDraft {
  if (!value || typeof value !== "object") return false;
  const draft = value as Partial<StoredFormDraft>;
  return (
    typeof draft.expiresAt === "number" &&
    Array.isArray(draft.fields) &&
    draft.fields.every(
      (field) =>
        field &&
        typeof field.key === "string" &&
        typeof field.value === "string" &&
        (field.checked === undefined || typeof field.checked === "boolean"),
    )
  );
}
