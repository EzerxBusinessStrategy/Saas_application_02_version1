import { describe, expect, test } from "vitest";
import {
  parseAllocatedWorkFilters,
  serializeAllocatedWorkFilters,
} from "@/components/tenant-administration/allocated-work-filters";

describe("allocated work URL filters", () => {
  test("reads distinct KPI card query strings", () => {
    expect(parseAllocatedWorkFilters(new URLSearchParams("status=open&from=2026-04-01&to=2027-03-31&range=kpi"))).toMatchObject({
      status: "open",
      from: "2026-04-01",
      to: "2027-03-31",
      range: "kpi",
    });
    expect(parseAllocatedWorkFilters(new URLSearchParams("status=completed&from=2026-04-01&to=2027-03-31&range=kpi")).status).toBe(
      "completed",
    );
    expect(parseAllocatedWorkFilters(new URLSearchParams("status=overdue"))).toMatchObject({
      status: "overdue",
      from: "",
      to: "",
      range: "due",
    });
  });

  test("keeps kpi range only when a date window is present", () => {
    const query = serializeAllocatedWorkFilters({
      clientId: "",
      employeeId: "",
      serviceId: "",
      status: "completed",
      from: "2026-04-01",
      to: "2027-03-31",
      atRisk: false,
      range: "kpi",
    });
    expect(query).toBe("status=completed&from=2026-04-01&to=2027-03-31&range=kpi");
  });
});
