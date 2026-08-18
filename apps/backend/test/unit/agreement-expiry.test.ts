import { describe, expect, test } from "vitest";
import { agreementAccessStatus, isAgreementExpired } from "../../src/platform/agreement-expiry";

describe("agreement expiry", () => {
  test("marks agreements expired only after validUntil", () => {
    const now = new Date("2026-08-18T12:00:00.000Z");

    expect(isAgreementExpired("agreement", "2026-08-18T11:59:59.000Z", now)).toBe(true);
    expect(isAgreementExpired("agreement", "2026-08-18T12:00:01.000Z", now)).toBe(false);
    expect(isAgreementExpired("supporting", "2026-08-18T11:59:59.000Z", now)).toBe(false);
    expect(agreementAccessStatus("agreement", "2026-08-18T11:59:59.000Z", now)).toBe("expired");
    expect(agreementAccessStatus("agreement", "2026-08-19T00:00:00.000Z", now)).toBe("active");
    expect(agreementAccessStatus("invoice", "2026-08-18T11:59:59.000Z", now)).toBeNull();
  });
});
