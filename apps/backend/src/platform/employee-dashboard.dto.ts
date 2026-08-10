import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class EmployeeDashboardSummaryDto {
  @ApiProperty({ type: Number }) dueToday!: number;
  @ApiProperty({ type: Number }) inProgress!: number;
  @ApiProperty({ type: Number }) needsChanges!: number;
}

export class EmployeeDashboardTaskDto {
  @ApiProperty({ type: String }) id!: string;
  @ApiProperty({ type: String }) title!: string;
  @ApiProperty({ type: String }) clientName!: string;
  @ApiProperty({ type: String }) serviceName!: string;
  @ApiPropertyOptional({ type: String, nullable: true }) description!: string | null;
  @ApiProperty({ type: String }) status!: string;
  @ApiProperty({ type: String }) statusLabel!: string;
  @ApiPropertyOptional({ type: String, nullable: true }) plannedDueAt!: string | null;
  @ApiProperty({ type: Boolean }) dueToday!: boolean;
  @ApiProperty({ type: String }) actionLabel!: string;
  @ApiProperty({ type: Boolean }) needsChanges!: boolean;
  @ApiPropertyOptional({ type: String, nullable: true }) latestManagerNote!: string | null;
}

export class EmployeeDashboardWorkLogDto {
  @ApiProperty({ type: Number }) loggedMinutes!: number;
  @ApiProperty({ type: String }) status!: "not_started" | "draft" | "submitted" | "reviewed";
}

export class EmployeeDashboardResponseDto {
  @ApiProperty({ type: String }) employeeName!: string;
  @ApiProperty({ type: String }) today!: string;
  @ApiProperty({ type: () => EmployeeDashboardSummaryDto }) summary!: EmployeeDashboardSummaryDto;
  @ApiProperty({ type: () => EmployeeDashboardTaskDto, isArray: true })
  tasks!: readonly EmployeeDashboardTaskDto[];
  @ApiProperty({ type: () => EmployeeDashboardWorkLogDto }) workLog!: EmployeeDashboardWorkLogDto;
}
