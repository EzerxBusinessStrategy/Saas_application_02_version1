import { ApiProperty } from "@nestjs/swagger";
import { z } from "zod";

export const submitClientTaskFeedbackSchema = z.object({
  taskId: z.string().uuid(),
  invoiceId: z.string().uuid(),
  taskRating: z.number().int().min(1).max(5),
  employeeRating: z.number().int().min(1).max(5),
  idempotencyKey: z.string().min(8).max(128),
});

export type SubmitClientTaskFeedback = z.infer<typeof submitClientTaskFeedbackSchema>;

export class PendingTaskFeedbackItemDto {
  @ApiProperty()
  taskId!: string;

  @ApiProperty()
  taskTitle!: string;

  @ApiProperty()
  invoiceId!: string;

  @ApiProperty()
  invoiceNumber!: string;

  @ApiProperty()
  employeeId!: string;

  @ApiProperty()
  employeeName!: string;

  @ApiProperty()
  invoiceSentAt!: string;

  @ApiProperty()
  completedAt!: string;

  @ApiProperty()
  expiresAt!: string;
}

export class PendingTaskFeedbackResponseDto {
  @ApiProperty({ type: () => PendingTaskFeedbackItemDto, isArray: true })
  items!: PendingTaskFeedbackItemDto[];
}

export class ClientTaskFeedbackDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  taskId!: string;

  @ApiProperty()
  taskTitle!: string;

  @ApiProperty()
  invoiceId!: string;

  @ApiProperty()
  employeeId!: string;

  @ApiProperty()
  employeeName!: string;

  @ApiProperty()
  taskRating!: number;

  @ApiProperty()
  employeeRating!: number;

  @ApiProperty()
  replayed!: boolean;

  @ApiProperty()
  createdAt!: string;
}

export class TaskFeedbackLogItemDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  taskId!: string;

  @ApiProperty()
  taskTitle!: string;

  @ApiProperty()
  clientId!: string;

  @ApiProperty()
  clientName!: string;

  @ApiProperty()
  employeeId!: string;

  @ApiProperty()
  employeeName!: string;

  @ApiProperty({ nullable: true, type: Number })
  taskRating!: number | null;

  @ApiProperty({ nullable: true, type: Number })
  employeeRating!: number | null;

  @ApiProperty({ enum: ["submitted", "expired"] })
  status!: "submitted" | "expired";

  @ApiProperty()
  createdAt!: string;
}

export class TaskFeedbackLogResponseDto {
  @ApiProperty({ type: () => TaskFeedbackLogItemDto, isArray: true })
  items!: TaskFeedbackLogItemDto[];

  @ApiProperty()
  total!: number;
}
