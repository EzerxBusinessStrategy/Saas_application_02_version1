import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class EmployeeProfileDto {
  @ApiProperty({ type: String }) id!: string;
  @ApiProperty({ type: String }) name!: string;
  @ApiProperty({ type: String }) email!: string;
  @ApiProperty({ type: String }) employeeCode!: string;
  @ApiProperty({ type: String }) tenantName!: string;
  @ApiProperty({ type: String }) role!: string;
  @ApiProperty({ type: String }) status!: string;
  @ApiPropertyOptional({ type: String, nullable: true }) department!: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) experienceLevel!: string | null;
  @ApiPropertyOptional({ type: Number, nullable: true }) weeklyCapacityHours!: number | null;
  @ApiProperty({ type: [String] }) workGroups!: readonly string[];
}
