import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { z } from "zod";
import { ClientPortalDashboardRequestDto } from "./client-portal-dashboard.dto";

export class ClientPortalRequestServiceOptionDto {
  @ApiProperty({ type: String }) id!: string;
  @ApiProperty({ type: String }) name!: string;
}

export class ClientPortalRequestOptionsResponseDto {
  @ApiProperty({ type: () => ClientPortalRequestServiceOptionDto, isArray: true })
  services!: readonly ClientPortalRequestServiceOptionDto[];
}

export class CreateClientPortalRequestDto {
  @ApiProperty({ type: String }) serviceId!: string;
  @ApiProperty({ type: String }) title!: string;
  @ApiProperty({ type: String }) description!: string;
  @ApiProperty({ type: String }) countryCode!: string;
  @ApiPropertyOptional({ type: String, nullable: true }) requestedDueDate?: string | null;
  @ApiProperty({ type: String, enum: ["low", "normal", "high", "urgent"] }) priority!: "low" | "normal" | "high" | "urgent";
}

export class ClientPortalRequestCreatedDto extends ClientPortalDashboardRequestDto {}

export const createClientPortalRequestSchema = z.object({
  serviceId: z.string().uuid(),
  title: z.string().trim().min(2).max(160),
  description: z.string().trim().min(2).max(2000),
  countryCode: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/),
  requestedDueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
});

export type CreateClientPortalRequest = z.infer<typeof createClientPortalRequestSchema>;
