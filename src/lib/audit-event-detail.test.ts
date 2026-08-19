import { describe, expect, it } from "vitest";
import { humaniseAuditAction, parseAuditEventDetail } from "./audit-event-detail";

describe("parseAuditEventDetail", () => {
  it("orders operational names first and hides secret keys", () => {
    const fields = parseAuditEventDetail(
      JSON.stringify({
        employeeId: "11111111-1111-4111-8111-111111111111",
        employeeName: "Rahul",
        managerName: "Anita",
        clientName: "Acme Operations",
        resourceLabel: "demo1 (2026-08-19)",
        passwordHash: "secret",
        remarks: "Please revise the filing.",
      }),
    );

    expect(fields.map((field) => field.label)).toEqual([
      "Client Name",
      "Resource Label",
      "Employee Name",
      "Manager Name",
      "Remarks",
      "Employee Id",
    ]);
    expect(fields.some((field) => field.key === "passwordHash")).toBe(false);
  });

  it("keeps non-json audit text as a single detail field", () => {
    expect(parseAuditEventDetail("legacy note")).toEqual([
      { key: "detail", label: "Detail", value: "legacy note" },
    ]);
  });
});

describe("humaniseAuditAction", () => {
  it("turns workflow action codes into readable labels", () => {
    expect(humaniseAuditAction("TENANT_TASK_RETURNED")).toBe("Tenant task returned");
    expect(humaniseAuditAction("INVOICE_CREATED_FROM_ENTRIES")).toBe("Invoice created from entries");
  });
});
