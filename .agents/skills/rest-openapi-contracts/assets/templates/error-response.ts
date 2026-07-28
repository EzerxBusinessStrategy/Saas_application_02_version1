import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ApiErrorBodyDto {
  @ApiProperty()
  code!: string;

  @ApiProperty()
  message!: string;

  @ApiProperty()
  requestId!: string;

  @ApiPropertyOptional()
  details?: unknown;
}

export class ApiErrorResponseDto {
  @ApiProperty({ type: ApiErrorBodyDto })
  error!: ApiErrorBodyDto;
}
