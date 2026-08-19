import { expect, test } from "vitest";
import { tenantServiceRequestErrorMessage } from "./tenant-service-requests-api";

test("reads the nested API error envelope used by accept and reject failures", () => {
  expect(
    tenantServiceRequestErrorMessage({
      error: { code: "VALIDATION_ERROR", message: "Request validation failed." },
    }),
  ).toBe("Request validation failed.");
  expect(
    tenantServiceRequestErrorMessage({
      error: {
        code: "COUNTRY_FINANCIAL_YEAR_REQUIRED",
        message: "Configure the current financial year for the selected country before activating services.",
      },
    }),
  ).toBe("Configure the current financial year for the selected country before activating services.");
  expect(tenantServiceRequestErrorMessage({ message: "Service request could not be accepted." })).toBe(
    "Service request could not be accepted.",
  );
  expect(tenantServiceRequestErrorMessage(null)).toBe("Service request failed.");
});
