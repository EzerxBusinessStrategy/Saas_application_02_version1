import { randomUUID } from "node:crypto";

export const REQUEST_ID_HEADER = "x-request-id";

const REQUEST_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/;

export function isSafeRequestId(value: string): boolean {
  return REQUEST_ID_PATTERN.test(value);
}

export function createRequestId(): string {
  return randomUUID();
}

export function resolveRequestId(header: string | string[] | undefined, fallback?: string): string {
  const inbound = Array.isArray(header) ? header[0] : header;
  if (inbound && isSafeRequestId(inbound)) return inbound;
  if (fallback && isSafeRequestId(fallback)) return fallback;
  return createRequestId();
}
