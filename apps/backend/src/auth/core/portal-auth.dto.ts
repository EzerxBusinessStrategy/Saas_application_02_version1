import { z } from "zod";

export const portalLoginSchema = z.object({
  email: z.string().trim().email().max(320).transform((value) => value.toLowerCase()),
  password: z.string().min(1).max(128),
});

export type PortalLoginRequest = z.infer<typeof portalLoginSchema>;

export type RequestMetadata = {
  readonly ipAddress?: string;
  readonly userAgent?: string;
};
