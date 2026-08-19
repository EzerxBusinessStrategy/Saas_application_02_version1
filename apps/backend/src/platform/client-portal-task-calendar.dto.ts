import { ApiProperty } from "@nestjs/swagger";
import { z } from "zod";
import {
  DASHBOARD_MAX_SPAN_DAYS,
  ISO_DATE_PATTERN,
  isoDateDiffDays,
} from "./tenant-admin-dashboard.period";

export const clientPortalTaskCalendarQuerySchema = z
  .object({
    from: z.string().regex(ISO_DATE_PATTERN),
    to: z.string().regex(ISO_DATE_PATTERN),
  })
  .superRefine((value, context) => {
    if (value.from > value.to) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["to"],
        message: "to must be on or after from.",
      });
    }
    if (isoDateDiffDays(value.from, value.to) > DASHBOARD_MAX_SPAN_DAYS) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Date range cannot exceed ${DASHBOARD_MAX_SPAN_DAYS} days.`,
      });
    }
  });

export type ClientPortalTaskCalendarQuery = z.infer<typeof clientPortalTaskCalendarQuerySchema>;

export class ClientPortalTaskCalendarAssigneeDto {
  @ApiProperty({ type: String })
  id!: string;

  @ApiProperty({ type: String })
  name!: string;
}

export class ClientPortalTaskCalendarTaskDto {
  @ApiProperty({ type: String })
  id!: string;

  @ApiProperty({ type: String })
  title!: string;

  @ApiProperty({ type: String })
  status!: string;

  @ApiProperty({ type: String })
  priority!: string;

  @ApiProperty({ type: String, format: "date-time" })
  plannedDueAt!: string;

  @ApiProperty({ type: String })
  serviceId!: string;

  @ApiProperty({ type: String })
  serviceName!: string;

  @ApiProperty({ type: String, nullable: true })
  frequency!: string | null;

  @ApiProperty({ type: () => [ClientPortalTaskCalendarAssigneeDto] })
  assignees!: readonly ClientPortalTaskCalendarAssigneeDto[];
}

export class ClientPortalTaskCalendarPeriodDto {
  @ApiProperty({ type: String, format: "date" })
  from!: string;

  @ApiProperty({ type: String, format: "date" })
  to!: string;
}

export class ClientPortalTaskCalendarResponseDto {
  @ApiProperty({ type: () => ClientPortalTaskCalendarPeriodDto })
  period!: ClientPortalTaskCalendarPeriodDto;

  @ApiProperty({ type: Number })
  total!: number;

  @ApiProperty({ type: () => [ClientPortalTaskCalendarTaskDto] })
  tasks!: readonly ClientPortalTaskCalendarTaskDto[];
}
