import { z } from "zod";
import { redirectToLoginOnUnauthorized } from "@/lib/client/silent-auth-redirect";

const serviceOptionSchema = z.object({
  id: z.string(),
  name: z.string(),
});

const requestSchema = z.object({
  id: z.string(),
  title: z.string(),
  status: z.string(),
  serviceName: z.string(),
  countryCode: z.string(),
  requestedDueDate: z.string().nullable(),
  submittedAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type ClientPortalRequestServiceOption = z.infer<typeof serviceOptionSchema>;
export type ClientPortalRequest = z.infer<typeof requestSchema>;

export async function listClientPortalRequestServices(): Promise<readonly ClientPortalRequestServiceOption[]> {
  const response = await fetch("/api/client-portal/requests/options", { cache: "no-store" });
  await redirectToLoginOnUnauthorized(response);
  return z.object({ services: z.array(serviceOptionSchema) }).parse(await parseBody(response)).services;
}

export async function createClientPortalServiceRequest(input: {
  serviceId: string;
  title: string;
  description: string;
  countryCode: string;
  requestedDueDate?: string | null;
  priority: "low" | "normal" | "high" | "urgent";
}): Promise<ClientPortalRequest> {
  const response = await fetch("/api/client-portal/requests", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  await redirectToLoginOnUnauthorized(response);
  return requestSchema.parse(await parseBody(response));
}

async function parseBody(response: Response) {
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(typeof body?.message === "string" ? body.message : "Client request failed.");
  }
  return body;
}
