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
  z.number().int().min(1).max(12).optional(),
);

export const superAdminSearchScopes = ["all", "tenants"] as const;

export const superAdminSearchQuerySchema = z.object({
  q: optionalQueryString.pipe(z.string().max(120).optional()),
  limit: optionalLimit,
  scope: optionalQueryString.pipe(z.enum(superAdminSearchScopes).optional()),
});

export type SuperAdminSearchQuery = z.infer<typeof superAdminSearchQuerySchema>;

export class SuperAdminSearchQueryDto {
  @ApiPropertyOptional({ type: String, minLength: 2, maxLength: 120, example: "northstar" })
  q?: string;

  @ApiPropertyOptional({ type: Number, minimum: 1, maximum: 12, default: 10 })
  limit?: number;

  @ApiPropertyOptional({ enum: superAdminSearchScopes, default: "all" })
  scope?: (typeof superAdminSearchScopes)[number];
}

export class SuperAdminSearchResultDto {
  @ApiProperty({ type: String })
  id!: string;

  @ApiProperty({ enum: ["tenant", "user"] })
  type!: "tenant" | "user";

  @ApiProperty({ type: String })
  title!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  subtitle!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  code!: string | null;

  @ApiProperty({ type: String })
  status!: string;

  @ApiProperty({ type: String })
  href!: string;
}

export class SuperAdminSearchResponseDto {
  @ApiProperty({ type: String })
  query!: string;

  @ApiProperty({ type: Number })
  limit!: number;

  @ApiProperty({ type: () => [SuperAdminSearchResultDto] })
  results!: readonly SuperAdminSearchResultDto[];
}
