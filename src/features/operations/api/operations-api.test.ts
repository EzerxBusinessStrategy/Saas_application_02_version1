import { afterEach, expect, test, vi } from "vitest";
import { createSharedDocument, listSharedDocuments, listWorkLogs } from "@/features/operations/api/operations-api";

afterEach(() => {
  vi.restoreAllMocks();
});

test("uploads the original file bytes to the signed storage URL before creating a shared document", async () => {
  const file = new File(["agreement content"], "agreement.png", { type: "image/png" });
  const fetchMock = vi.spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(new Response(JSON.stringify({
      storageKey: "tenants/tenant-1/clients/client-1/tenant/request-1.png",
      signedUrl: "https://storage.example.test/upload",
    }), { status: 201, headers: { "content-type": "application/json" } }))
    .mockResolvedValueOnce(new Response(null, { status: 200 }))
    .mockResolvedValueOnce(new Response(JSON.stringify({
      id: "document-1",
      clientId: "client-1",
      client: "Acme Operations",
      title: "Agreement",
      fileName: file.name,
      fileType: "PNG",
      sizeBytes: file.size,
      category: "agreement",
      uploadedBy: "Tenant Admin",
      updatedOn: "2026-08-14T00:00:00.000Z",
      status: "active",
      clientDecisionStatus: "pending",
      clientDecisionAt: null,
      clientDecisionBy: null,
      clientDecisionComment: null,
      shareReason: "Please review.",
    }), { status: 201, headers: { "content-type": "application/json" } }));

  await createSharedDocument("admin", {
    clientId: "client-1",
    title: "Agreement",
    fileName: file.name,
    fileType: "PNG",
    sizeBytes: file.size,
    category: "agreement",
    recipientEmployeeIds: ["employee-1"],
    recipientClientIds: ["client-1"],
    shareReason: "Please review.",
    file,
  });

  expect(fetchMock).toHaveBeenNthCalledWith(2, "https://storage.example.test/upload", {
    method: "PUT",
    headers: { "content-type": "image/png" },
    body: file,
  });
  expect(JSON.parse(String(fetchMock.mock.calls[2]?.[1]?.body))).toMatchObject({
    clientId: "client-1",
    recipientEmployeeIds: ["employee-1"],
  });
});

test("uploads an employee-only document without a related client", async () => {
  const file = new File(["internal note"], "note.pdf", { type: "application/pdf" });
  const fetchMock = vi.spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(new Response(JSON.stringify({
      storageKey: "tenants/tenant-1/internal/tenant/request-2.pdf",
      signedUrl: "https://storage.example.test/upload",
    }), { status: 201, headers: { "content-type": "application/json" } }))
    .mockResolvedValueOnce(new Response(null, { status: 200 }))
    .mockResolvedValueOnce(new Response(JSON.stringify({
      id: "document-2",
      clientId: null,
      client: "Not linked",
      title: "Internal note",
      fileName: file.name,
      fileType: "PDF",
      sizeBytes: file.size,
      category: "supporting",
      uploadedBy: "Tenant Admin",
      updatedOn: "2026-08-17T00:00:00.000Z",
      status: "active",
      clientDecisionStatus: "pending",
      clientDecisionAt: null,
      clientDecisionBy: null,
      clientDecisionComment: null,
      shareReason: "For employee review.",
    }), { status: 201, headers: { "content-type": "application/json" } }));

  await createSharedDocument("admin", {
    title: "Internal note",
    fileName: file.name,
    fileType: "PDF",
    sizeBytes: file.size,
    category: "supporting",
    recipientEmployeeIds: ["employee-1"],
    recipientClientIds: [],
    shareReason: "For employee review.",
    file,
  });

  expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).not.toHaveProperty("clientId");
  expect(JSON.parse(String(fetchMock.mock.calls[2]?.[1]?.body))).toMatchObject({
    recipientEmployeeIds: ["employee-1"],
  });
  expect(JSON.parse(String(fetchMock.mock.calls[2]?.[1]?.body))).not.toHaveProperty("clientId");
});

test("lists tenant documents that are not linked to a client", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response(JSON.stringify({
    documents: [{
      id: "document-internal",
      clientId: null,
      client: "Not linked",
      title: "Employee handbook",
      fileName: "handbook.pdf",
      fileType: "PDF",
      sizeBytes: 1000,
      category: "supporting",
      uploadedBy: "Tenant Admin",
      updatedOn: "2026-08-17T10:39:19.706Z",
      status: "active",
      clientDecisionStatus: "pending",
      clientDecisionAt: null,
      clientDecisionBy: null,
      clientDecisionComment: null,
      shareReason: null,
    }],
  }), { status: 200, headers: { "content-type": "application/json" } }));

  await expect(listSharedDocuments("admin")).resolves.toEqual([
    expect.objectContaining({
      id: "document-internal",
      clientId: "",
      client: "Not linked",
      recipientClientIds: [],
    }),
  ]);
});

test("lists tenant documents when an invoice PDF is stored with category invoice", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response(JSON.stringify({
    documents: [{
      id: "3cb036fe-dcca-4d35-9b3c-08a6cd354a48",
      clientId: "client-1",
      client: "Acme Operations",
      title: "Invoice 1",
      fileName: "invoice-1.pdf",
      fileType: "PDF",
      sizeBytes: 1000,
      category: "invoice",
      uploadedBy: "System",
      updatedOn: "2026-08-14T10:39:19.706Z",
      status: "active",
      clientDecisionStatus: "pending",
      clientDecisionAt: null,
      clientDecisionBy: null,
      clientDecisionComment: null,
      shareReason: "Invoice sent to client.",
      storageKey: "tenants/tenant-1/invoices/invoice-1.pdf",
    }],
  }), { status: 200, headers: { "content-type": "application/json" } }));

  await expect(listSharedDocuments("admin")).resolves.toEqual([
    expect.objectContaining({ id: "3cb036fe-dcca-4d35-9b3c-08a6cd354a48", category: "invoice", title: "Invoice 1" }),
  ]);
});

test("accepts RFC 3339 work-segment timestamps returned by PostgreSQL JSON", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response(JSON.stringify({
    logs: [{
      date: "2026-08-14",
      taskId: "task-1",
      taskTitle: "Prepare filing",
      clientName: "Acme Operations",
      workedSeconds: 120,
      segments: [{
        startedAt: "2026-08-14T07:00:00+00:00",
        endedAt: "2026-08-14T07:02:00+00:00",
        workedSeconds: 120,
      }],
    }],
  }), { status: 200, headers: { "content-type": "application/json" } }));

  await expect(listWorkLogs("employee")).resolves.toEqual([
    expect.objectContaining({ taskId: "task-1", durationMinutes: 2 }),
  ]);
});
