import { z } from "zod";
import { redirectToLoginOnUnauthorized } from "@/lib/client/silent-auth-redirect";

const clientServiceCommentSchema = z.object({
  id: z.string(),
  serviceId: z.string(),
  serviceName: z.string(),
  body: z.string(),
  replayed: z.boolean(),
  createdAt: z.string(),
});

export type ClientServiceComment = z.infer<typeof clientServiceCommentSchema>;

export async function createClientServiceComment(
  serviceId: string,
  input: { idempotencyKey: string; body: string },
): Promise<ClientServiceComment> {
  const response = await fetch(
    `/api/client-portal/services/${encodeURIComponent(serviceId)}/comments`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    },
  );
  await redirectToLoginOnUnauthorized(response);
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(
      typeof body?.message === "string" ? body.message : "Comment could not be sent.",
    );
  }
  return clientServiceCommentSchema.parse(body);
}
