import { expect, test } from "vitest";
import {
  clientRequestStatusFilter,
  matchesClientDeliverableListFilters,
  matchesClientInvoiceListFilters,
  matchesClientRequestListFilters,
} from "@/components/operations/client-portal-list-filters";

test("groups backend request statuses into waiting, accepted, and rejected", () => {
  expect(clientRequestStatusFilter("submitted")).toBe("waiting");
  expect(clientRequestStatusFilter("under_review")).toBe("waiting");
  expect(clientRequestStatusFilter("accepted")).toBe("accepted");
  expect(clientRequestStatusFilter("rejected")).toBe("rejected");
  expect(clientRequestStatusFilter("cancelled")).toBe("other");
});

test("filters requests by status group and title or service name", () => {
  const item = { title: "GST booklet", serviceName: "GST Compliance", status: "submitted" };
  expect(matchesClientRequestListFilters(item, { search: "", status: "waiting" })).toBe(true);
  expect(matchesClientRequestListFilters(item, { search: "", status: "accepted" })).toBe(false);
  expect(matchesClientRequestListFilters(item, { search: "gst", status: "" })).toBe(true);
  expect(matchesClientRequestListFilters(item, { search: "payroll", status: "" })).toBe(false);
});

test("filters invoices by search, outstanding balance, and stored status", () => {
  const invoice = {
    invoiceNumber: "INV-104",
    serviceName: "GST Compliance",
    taskTitle: "GSTR-3B",
    status: "issued",
    outstandingAmount: 12000,
  };
  expect(matchesClientInvoiceListFilters(invoice, { search: "inv-104", balance: "", status: "" })).toBe(true);
  expect(matchesClientInvoiceListFilters(invoice, { search: "", balance: "outstanding", status: "" })).toBe(true);
  expect(matchesClientInvoiceListFilters(invoice, { search: "", balance: "paid", status: "" })).toBe(false);
  expect(matchesClientInvoiceListFilters(invoice, { search: "", balance: "", status: "paid" })).toBe(false);
  expect(matchesClientInvoiceListFilters({ ...invoice, outstandingAmount: 0, status: "paid" }, { search: "", balance: "paid", status: "paid" })).toBe(true);
});

test("filters deliverables by search, decision, category, and access", () => {
  const item = {
    title: "FY agreement",
    fileName: "agreement.pdf",
    category: "agreement",
    clientDecisionStatus: "pending" as const,
    accessStatus: "expired" as const,
  };
  expect(matchesClientDeliverableListFilters(item, { search: "agreement", decision: "pending", category: "", access: "expired" })).toBe(true);
  expect(matchesClientDeliverableListFilters(item, { search: "", decision: "approved", category: "", access: "" })).toBe(false);
  expect(matchesClientDeliverableListFilters(item, { search: "", decision: "", category: "supporting", access: "" })).toBe(false);
});
