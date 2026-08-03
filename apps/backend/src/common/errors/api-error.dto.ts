import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class ValidationErrorDetailDto {
  @ApiProperty({ type: String, example: "body.email" })
  path!: string;

  @ApiProperty({ type: String, example: "Invalid email address" })
  message!: string;
}

export class ApiErrorDto {
  @ApiProperty({ type: String, example: "VALIDATION_ERROR" })
  code!: string;

  @ApiProperty({ type: String, example: "Request validation failed." })
  message!: string;

  @ApiProperty({ type: String, example: "01HZY4EXAMPLE1234567890" })
  requestId!: string;

  @ApiPropertyOptional({ type: () => [ValidationErrorDetailDto] })
  details?: readonly ValidationErrorDetailDto[];
}

export class ApiErrorResponseDto {
  @ApiProperty({ type: () => ApiErrorDto })
  error!: ApiErrorDto;
}

export type ApiErrorResponse = {
  readonly error: {
    readonly code: string;
    readonly message: string;
    readonly requestId: string;
    readonly details?: readonly ValidationErrorDetailDto[];
  };
};
