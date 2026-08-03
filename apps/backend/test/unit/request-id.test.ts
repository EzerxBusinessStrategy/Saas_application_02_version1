import { describe, expect, test } from "vitest";
import { isSafeRequestId, resolveRequestId } from "../../src/common/request-id/request-id";

describe("request IDs", () => {
  test("accepts bounded safe request IDs", () => {
    expect(isSafeRequestId("req-20260728-abc123")).toBe(true);
  });

  test("rejects unsafe request IDs", () => {
    expect(isSafeRequestId("../not-safe")).toBe(false);
    expect(isSafeRequestId("short")).toBe(false);
  });

  test("generates a replacement for unsafe inbound IDs", () => {
    const requestId = resolveRequestId("../not-safe");

    expect(requestId).not.toBe("../not-safe");
    expect(isSafeRequestId(requestId)).toBe(true);
  });
});
