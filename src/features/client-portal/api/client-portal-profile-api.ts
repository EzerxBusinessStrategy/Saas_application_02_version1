import { z } from "zod";
import { redirectToLoginOnUnauthorized } from "@/lib/client/silent-auth-redirect";

const clientPortalProfileSchema = z.object({
  portalName: z.string(),
  primaryColour: z.string(),
  sidebarColour: z.string(),
  surfaceColour: z.string(),
});

export type ClientPortalProfile = z.infer<typeof clientPortalProfileSchema>;

export async function getClientPortalProfile(): Promise<ClientPortalProfile> {
  const response = await fetch("/api/client-portal/profile", { cache: "no-store" });
  await redirectToLoginOnUnauthorized(response);
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(typeof body?.message === "string" ? body.message : "Client profile could not load.");
  return clientPortalProfileSchema.parse(body);
}

export async function updateClientPortalProfile(input: ClientPortalProfile): Promise<ClientPortalProfile> {
  const response = await fetch("/api/client-portal/profile", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  await redirectToLoginOnUnauthorized(response);
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(typeof body?.message === "string" ? body.message : "Client profile could not be saved.");
  return clientPortalProfileSchema.parse(body);
}
