import { ApiProperty } from "@nestjs/swagger";

export class HealthCheckDto {
  @ApiProperty({ type: String, example: "configuration" })
  name!: string;

  @ApiProperty({ type: String, enum: ["up", "down", "not_configured"], example: "up" })
  status!: string;
}

export class LiveHealthResponseDto {
  @ApiProperty({ type: String, enum: ["ok"], example: "ok" })
  status!: string;

  @ApiProperty({ type: String, example: "SaaS App Backend" })
  service!: string;

  @ApiProperty({ type: String, example: "2026-07-28T10:30:00.000Z" })
  timestamp!: string;
}

export class ReadyHealthResponseDto {
  @ApiProperty({ type: String, enum: ["ready", "degraded"], example: "ready" })
  status!: string;

  @ApiProperty({ type: String, example: "SaaS App Backend" })
  service!: string;

  @ApiProperty({ type: [HealthCheckDto] })
  checks!: readonly HealthCheckDto[];

  @ApiProperty({ type: [HealthCheckDto], description: "External dependencies checked by this process." })
  dependencies!: readonly HealthCheckDto[];

  @ApiProperty({ type: String, example: "2026-07-28T10:30:00.000Z" })
  timestamp!: string;
}
