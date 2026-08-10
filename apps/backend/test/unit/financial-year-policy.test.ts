import { describe, expect, it } from "vitest";
import { suggestFinancialYear } from "../../src/platform/financial-year-policy";

describe("suggestFinancialYear", () => {
  const today = new Date("2026-08-10T00:00:00.000Z");

  it("uses the Super Admin country formula for India and United States", () => {
    expect(suggestFinancialYear({ policyMode: "COUNTRY_FIXED", startMonth: 4, startDay: 1, endMonth: 3, endDay: 31 }, undefined, today)).toEqual({
      label: "FY 2026-27",
      startsOn: "2026-04-01",
      endsOn: "2027-03-31",
    });
    expect(suggestFinancialYear({ policyMode: "COMPANY_DEFINED", startMonth: 1, startDay: 1, endMonth: 12, endDay: 31 }, undefined, today)).toEqual({
      label: "FY 2026",
      startsOn: "2026-01-01",
      endsOn: "2026-12-31",
    });
  });

  it("uses the supplied anchor for incorporation-derived calendars", () => {
    expect(suggestFinancialYear({ policyMode: "INCORPORATION_DERIVED", startMonth: 1, startDay: 1, endMonth: 12, endDay: 31 }, "2026-08-10", today)).toEqual({
      label: "FY ending 2027-08",
      startsOn: "2026-08-10",
      endsOn: "2027-08-31",
    });
  });
});
