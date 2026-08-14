import { afterEach, expect, test, vi } from "vitest";
import { createSharedDocument } from "@/features/operations/api/operations-api";

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
