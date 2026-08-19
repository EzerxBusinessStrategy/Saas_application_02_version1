const hiddenAuditKeys = new Set([
  "password",
  "passwordHash",
  "token",
  "accessToken",
  "refreshToken",
  "storageKey",
  "signedUrl",
]);

const preferredAuditDetailOrder = [
  "tenantName",
  "actorName",
  "clientName",
  "resourceLabel",
  "employeeName",
  "managerName",
  "invoiceNumber",
  "remarks",
] as const;

export type AuditDetailField = {
  readonly key: string;
  readonly label: string;
  readonly value: string;
};

export function parseAuditEventDetail(detail: string): readonly AuditDetailField[] {
  const trimmed = detail.trim();
  if (!trimmed) return [];
  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (!isRecord(parsed)) {
      return [{ key: "detail", label: "Detail", value: trimmed }];
    }
    const entries = Object.entries(parsed)
      .filter(([key, value]) => !hiddenAuditKeys.has(key) && value != null && value !== "")
      .map(([key, value]) => ({
        key,
        label: humaniseAuditKey(key),
        value: formatAuditDetailValue(value),
      }));
    const rank = new Map(preferredAuditDetailOrder.map((key, index) => [key, index]));
    return [...entries].sort((left, right) => {
      const leftRank = rank.get(left.key as (typeof preferredAuditDetailOrder)[number]) ?? 100;
      const rightRank = rank.get(right.key as (typeof preferredAuditDetailOrder)[number]) ?? 100;
      if (leftRank !== rightRank) return leftRank - rightRank;
      return left.label.localeCompare(right.label);
    });
  } catch {
    return [{ key: "detail", label: "Detail", value: trimmed }];
  }
}

export function humaniseAuditAction(action: string): string {
  const trimmed = action.trim();
  if (!trimmed) return "Unknown action";
  return trimmed.replaceAll("_", " ").toLowerCase().replace(/^\w/, (letter) => letter.toUpperCase());
}

function humaniseAuditKey(key: string): string {
  return key
    .replaceAll(/([a-z])([A-Z])/g, "$1 $2")
    .replaceAll("_", " ")
    .replace(/^\w/, (letter) => letter.toUpperCase());
}

function formatAuditDetailValue(value: unknown): string {
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return JSON.stringify(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
