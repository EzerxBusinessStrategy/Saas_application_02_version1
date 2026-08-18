import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { z } from "zod";

const optionalUuid = z.preprocess((value) => (value === "" ? undefined : value), z.string().uuid().optional());
const optionalDate = z.preprocess((value) => (value === "" ? undefined : value), z.string().date().optional());

export const taskFeedbackLogQuerySchema = z.object({
  status: z.enum(["submitted", "expired"]).optional(),
  from: optionalDate,
  to: optionalDate,
  employeeId: optionalUuid,
  clientId: optionalUuid,
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});
export type TaskFeedbackLogQuery = z.infer<typeof taskFeedbackLogQuerySchema>;

export const submitClientTaskFeedbackSchema = z.object({
  taskId: z.string().uuid(),
  invoiceId: z.string().uuid(),
  taskRating: z.number().int().min(1).max(5),
  employeeRating: z.number().int().min(1).max(5),
  idempotencyKey: z.string().min(8).max(128),
});

export type SubmitClientTaskFeedback = z.infer<typeof submitClientTaskFeedbackSchema>;

export class PendingTaskFeedbackItemDto {
  @ApiProperty({ type: String })
  taskId!: string;

  @ApiProperty({ type: String })
  taskTitle!: string;

  @ApiProperty({ type: String })
  invoiceId!: string;

  @ApiProperty({ type: String })
  invoiceNumber!: string;

  @ApiProperty({ type: String })
  employeeId!: string;

  @ApiProperty({ type: String })
  employeeName!: string;

  @ApiProperty({ type: String, format: "date-time" })
  invoiceSentAt!: string;

  @ApiProperty({ type: String, format: "date-time" })
  completedAt!: string;

  @ApiProperty({ type: String, format: "date-time" })
  expiresAt!: string;
}

export class PendingTaskFeedbackResponseDto {
  @ApiProperty({ type: () => PendingTaskFeedbackItemDto, isArray: true })
  items!: PendingTaskFeedbackItemDto[];
}

export class ClientTaskFeedbackDto {
  @ApiProperty({ type: String })
  id!: string;

  @ApiProperty({ type: String })
  taskId!: string;

  @ApiProperty({ type: String })
  taskTitle!: string;

  @ApiProperty({ type: String })
  invoiceId!: string;

  @ApiProperty({ type: String })
  employeeId!: string;

  @ApiProperty({ type: String })
  employeeName!: string;

  @ApiProperty({ type: Number })
  taskRating!: number;

  @ApiProperty({ type: Number })
  employeeRating!: number;

  @ApiProperty({ type: Boolean })
  replayed!: boolean;

  @ApiProperty({ type: String, format: "date-time" })
  createdAt!: string;
}

export class TaskFeedbackLogItemDto {
  @ApiProperty({ type: String })
  id!: string;

  @ApiProperty({ type: String })
  taskId!: string;

  @ApiProperty({ type: String })
  taskTitle!: string;

  @ApiProperty({ type: String })
  clientId!: string;

  @ApiProperty({ type: String })
  clientName!: string;

  @ApiProperty({ type: String })
  employeeId!: string;

  @ApiProperty({ type: String })
  employeeName!: string;

  @ApiProperty({ type: Number, nullable: true })
  taskRating!: number | null;

  @ApiProperty({ type: Number, nullable: true })
  employeeRating!: number | null;

  @ApiProperty({ type: String, enum: ["submitted", "expired"] })
  status!: "submitted" | "expired";

  @ApiProperty({ type: String, format: "date-time" })
  createdAt!: string;
}

export class TaskFeedbackLogResponseDto {
  @ApiProperty({ type: () => TaskFeedbackLogItemDto, isArray: true })
  items!: TaskFeedbackLogItemDto[];

  @ApiProperty({ type: Number })
  total!: number;

  @ApiProperty({ type: Number })
  page!: number;

  @ApiProperty({ type: Number })
  pageSize!: number;

  @ApiProperty({ type: Number })
  pageCount!: number;
}
