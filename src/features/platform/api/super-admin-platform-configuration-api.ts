import { redirectToLoginOnUnauthorized } from "@/lib/client/silent-auth-redirect";
import {
  platformConfigurationSchema,
  type PlatformConfiguration,
} from "@/types/platform-configuration";

export async function getPlatformConfiguration(): Promise<PlatformConfiguration> {
  const response = await fetch("/api/super-admin/platform-configuration", { cache: "no-store" });
  await redirectToLoginOnUnauthorized(response);
  if (!response.ok) throw new Error("Platform configuration could not load.");
  return platformConfigurationSchema.parse(await response.json());
}

export async function updatePlatformConfiguration(
  configuration: PlatformConfiguration,
): Promise<PlatformConfiguration> {
  const response = await fetch("/api/super-admin/platform-configuration", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(configuration),
  });
  await redirectToLoginOnUnauthorized(response);
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error?.message ?? body?.message ?? "Platform configuration could not be saved.");
  }
  return platformConfigurationSchema.parse(await response.json());
}
