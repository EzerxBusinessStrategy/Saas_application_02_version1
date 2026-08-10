import { z } from "zod";

export const employeeProfileSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  employeeCode: z.string(),
  tenantName: z.string(),
  role: z.string(),
  status: z.string(),
  department: z.string().nullable(),
  experienceLevel: z.string().nullable(),
  weeklyCapacityHours: z.number().nullable(),
  workGroups: z.array(z.string()),
});

export type EmployeeProfile = z.infer<typeof employeeProfileSchema>;

export async function getEmployeeProfile(): Promise<EmployeeProfile> {
  const response = await fetch("/api/employee/profile", { cache: "no-store" });
  if (!response.ok) throw new Error("Employee profile could not load.");
  return employeeProfileSchema.parse(await response.json());
}
