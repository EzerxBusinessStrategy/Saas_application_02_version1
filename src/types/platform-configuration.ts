import { z } from "zod";

export const platformConfigurationSchema = z.object({
  platformName: z.string(),
  defaultBrand: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  senderName: z.string(),
});

export type PlatformConfiguration = z.infer<typeof platformConfigurationSchema>;
