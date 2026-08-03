import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { z } from "zod";

const optionalQueryString = z.preprocess(
  (value) => {
    const raw = Array.isArray(value) ? value[0] : value;
    if (typeof raw !== "string") return undefined;
    const trimmed = raw.trim();
    return trimmed || undefined;
  },
  z.string().optional(),
);

const optionalLimit = z.preprocess(
  (value) => {
    const raw = Array.isArray(value) ? value[0] : value;
    if (typeof raw !== "string" || raw.trim() === "") return undefined;
    return Number(raw);
  },
  z.number().int().min(1).max(50).optional(),
);

export const notificationStatuses = ["ALL", "UNREAD", "READ"] as const;
export const notificationSeverities = ["INFO", "SUCCESS", "WARNING", "CRITICAL"] as const;

export const superAdminNotificationsQuerySchema = z.object({
  status: optionalQueryString.pipe(z.enum(notificationStatuses).optional()),
  limit: optionalLimit,
});

export type SuperAdminNotificationsQuery = z.infer<typeof superAdminNotificationsQuerySchema>;

export class NotificationItemDto {
  @ApiProperty({ type: String, format: "uuid" })
  id!: string;

  @ApiProperty({ type: String, example: "TENANT_LOW_HEALTH" })
  type!: string;

  @ApiProperty({ type: String })
  title!: string;

  @ApiProperty({ type: String })
  message!: string;

  @ApiProperty({ enum: notificationSeverities })
  severity!: (typeof notificationSeverities)[number];

  @ApiPropertyOptional({ type: String, nullable: true })
  tenantId!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  actionUrl!: string | null;

  @ApiProperty({ type: String, format: "date-time" })
  createdAt!: string;

  @ApiPropertyOptional({ type: String, format: "date-time", nullable: true })
  readAt!: string | null;
}

export class NotificationsResponseDto {
  @ApiProperty({ type: Number })
  unreadCount!: number;

  @ApiProperty({ type: () => [NotificationItemDto] })
  items!: readonly NotificationItemDto[];
}

export class UnreadCountResponseDto {
  @ApiProperty({ type: Number })
  unreadCount!: number;
}
