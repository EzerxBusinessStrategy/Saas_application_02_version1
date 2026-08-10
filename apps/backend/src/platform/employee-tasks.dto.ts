import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { z } from "zod";

export const submitEmployeeTaskSchema = z.object({
  taskComment: z.string().trim().max(2000).optional().default(""),
});
export type SubmitEmployeeTaskRequest = z.infer<typeof submitEmployeeTaskSchema>;

export class EmployeeTaskTimerDto {
  @ApiProperty({ enum: ["not_started", "active", "paused", "submitted"] })
  status!: "not_started" | "active" | "paused" | "submitted";
  @ApiProperty({ type: Number }) workedSeconds!: number;
  @ApiPropertyOptional({ type: String, nullable: true }) activeSegmentStartedAt!: string | null;
  @ApiProperty({ type: String }) serverTime!: string;
}

export class EmployeeTaskDto {
  @ApiProperty({ type: String }) id!: string;
  @ApiProperty({ type: String }) title!: string;
  @ApiProperty({ type: String }) description!: string;
  @ApiProperty({ type: String }) clientId!: string;
  @ApiProperty({ type: String }) clientName!: string;
  @ApiProperty({ type: String }) serviceId!: string;
  @ApiProperty({ type: String }) serviceName!: string;
  @ApiPropertyOptional({ type: String, nullable: true }) workGroupId!: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) workGroupName!: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) assignedBy!: string | null;
  @ApiProperty({ type: String }) priority!: string;
  @ApiProperty({ type: String }) status!: string;
  @ApiPropertyOptional({ type: String, nullable: true }) plannedDueAt!: string | null;
  @ApiProperty({ type: Boolean }) needsChanges!: boolean;
  @ApiPropertyOptional({ type: String, nullable: true }) latestManagerNote!: string | null;
  @ApiProperty({ type: () => EmployeeTaskTimerDto }) timer!: EmployeeTaskTimerDto;
}

export class EmployeeTasksResponseDto {
  @ApiProperty({ type: () => EmployeeTaskDto, isArray: true })
  tasks!: readonly EmployeeTaskDto[];
}

export class EmployeeWorkLogSegmentDto {
  @ApiProperty({ type: String }) startedAt!: string;
  @ApiPropertyOptional({ type: String, nullable: true }) endedAt!: string | null;
  @ApiProperty({ type: Number }) workedSeconds!: number;
}

export class EmployeeWorkLogDto {
  @ApiProperty({ type: String }) date!: string;
  @ApiProperty({ type: String }) taskId!: string;
  @ApiProperty({ type: String }) taskTitle!: string;
  @ApiProperty({ type: String }) clientName!: string;
  @ApiProperty({ type: Number }) workedSeconds!: number;
  @ApiProperty({ type: () => EmployeeWorkLogSegmentDto, isArray: true })
  segments!: readonly EmployeeWorkLogSegmentDto[];
}

export class EmployeeWorkLogsResponseDto {
  @ApiProperty({ type: () => EmployeeWorkLogDto, isArray: true })
  logs!: readonly EmployeeWorkLogDto[];
}
