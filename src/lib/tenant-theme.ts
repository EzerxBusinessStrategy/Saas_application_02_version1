import { z } from "zod";

export const tenantThemeSchema = z.object({
  name: z.string().min(1),
  primary: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  logo: z.string().url().optional(),
});
export const isAccessibleBrandColour = (hex: string) =>
  tenantThemeSchema.shape.primary.safeParse(hex).success;
