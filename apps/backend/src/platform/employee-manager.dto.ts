import { z } from "zod";
import { createTenantAdminTaskSchema, TenantAdminTaskOptionsResponseDto } from "./tenant-admin-tasks.dto";

export const employeeManagerCreateTaskSchema = createTenantAdminTaskSchema;
export type EmployeeManagerCreateTaskRequest = z.infer<typeof employeeManagerCreateTaskSchema>;

export const employeeManagerReviewSchema = z.object({
  decision: z.enum(["approve", "return"]),
  remarks: z.string().trim().max(1000).optional().default(""),
}).superRefine((value, ctx) => {
  if (value.decision === "return" && !value.remarks) {
    ctx.addIssue({ code: "custom", path: ["remarks"], message: "Enter a reason for returning this task." });
  }
});
export type EmployeeManagerReviewRequest = z.infer<typeof employeeManagerReviewSchema>;

export class EmployeeManagerClientDto {
  id!: string;
  name!: string;
  status!: string;
  openTasks!: number;
}

export class EmployeeManagerClientsResponseDto {
  clients!: EmployeeManagerClientDto[];
}

export class EmployeeManagerReviewTaskDto {
  id!: string;
  title!: string;
  clientName!: string;
  employeeName!: string;
  submittedAt!: string;
  workedSeconds!: number;
  taskComment!: string | null;

  status!: "manager_review" | "in_progress" | "completed";

  submissionStatus!: "submitted" | "returned" | "manager_approved" | "tenant_approved" | "cancelled";
}

export class EmployeeManagerReviewsResponseDto {
  tasks!: EmployeeManagerReviewTaskDto[];
}

export class EmployeeManagerTaskOptionsResponseDto extends TenantAdminTaskOptionsResponseDto {}
