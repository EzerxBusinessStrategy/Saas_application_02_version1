import { z } from "zod";

export const portalLoginSchema = z.object({
  email: z.string().trim().email().max(320).transform((value) => value.toLowerCase()),
  password: z.string().min(1).max(128),
});

export type PortalLoginRequest = z.infer<typeof portalLoginSchema>;

export const switchContextSchema = z.object({
  workspace: z.enum(["super-admin", "admin", "employee"]),
  tenantId: z.string().uuid().optional(),
}).superRefine((value, context) => {
  if (value.workspace !== "super-admin" && !value.tenantId) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["tenantId"],
      message: "Select an organisation workspace.",
    });
  }
});

export type SwitchContextRequest = z.infer<typeof switchContextSchema>;

export type RequestMetadata = {
  readonly ipAddress?: string;
  readonly userAgent?: string;
  readonly requestId?: string;
};
