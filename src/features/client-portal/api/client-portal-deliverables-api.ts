import { z } from "zod";
import { redirectToLoginOnUnauthorized } from "@/lib/client/silent-auth-redirect";

const clientPortalDeliverableSchema = z.object({
  id: z.string(),
  title: z.string(),
  fileName: z.string(),
  fileType: z.string(),
  sizeBytes: z.number(),
  category: z.string(),
  uploadedBy: z.string(),
  updatedOn: z.string(),
  clientDecisionStatus: z.enum(["pending", "approved", "rejected"]),
  clientDecisionAt: z.string().nullable(),
  clientDecisionComment: z.string().nullable(),
});

const clientPortalDeliverablesResponseSchema = z.object({
  deliverables: z.array(clientPortalDeliverableSchema),
});

export type ClientPortalDeliverable = z.infer<typeof clientPortalDeliverableSchema>;

export async function listClientPortalDeliverables(): Promise<readonly ClientPortalDeliverable[]> {
  const response = await fetch("/api/client-portal/deliverables", { cache: "no-store" });
  await redirectToLoginOnUnauthorized(response);
  return clientPortalDeliverablesResponseSchema.parse(await parseBody(response)).deliverables;
}

export async function decideClientPortalDeliverable(
  documentId: string,
  input: { decision: "approved" | "rejected"; comment?: string },
): Promise<ClientPortalDeliverable> {
  const response = await fetch(`/api/client-portal/deliverables/${encodeURIComponent(documentId)}/decision`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  await redirectToLoginOnUnauthorized(response);
  return clientPortalDeliverableSchema.parse(await parseBody(response));
}

export async function getClientPortalDeliverableDownloadUrl(documentId: string): Promise<string> {
  const response = await fetch(`/api/client-portal/deliverables/${encodeURIComponent(documentId)}/download`, { cache: "no-store" });
  await redirectToLoginOnUnauthorized(response);
  return z.object({ url: z.string().url() }).parse(await parseBody(response)).url;
}

export async function getClientPortalInvoiceDownloadUrl(invoiceId: string): Promise<string> {
  const response = await fetch(`/api/client-portal/invoices/${encodeURIComponent(invoiceId)}/download`, { cache: "no-store" });
  await redirectToLoginOnUnauthorized(response);
  return z.object({ url: z.string().url() }).parse(await parseBody(response)).url;
}

async function parseBody(response: Response) {
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(
      typeof body?.message === "string"
        ? body.message
        : "Client deliverables request failed.",
    );
  }
  return body;
}
