import { Body, Controller, HttpCode, Inject, Post } from "@nestjs/common";
import { ApiBody, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { ApiErrorResponseDto } from "../common/errors/api-error.dto";
import { ZodValidationPipe } from "../common/validation/zod-validation.pipe";
import { AuthIdentifyService } from "./auth-identify.service";
import {
  IdentifyEmailRequest,
  IdentifyEmailRequestDto,
  IdentifyEmailResponseDto,
  identifyEmailSchema,
} from "./auth-identify.dto";

@ApiTags("Identity")
@Controller("auth")
export class AuthIdentifyController {
  constructor(@Inject(AuthIdentifyService) private readonly service: AuthIdentifyService) {}

  @Post("identify")
  @HttpCode(200)
  @ApiOperation({ summary: "Verify a login email against active application users." })
  @ApiBody({ type: IdentifyEmailRequestDto })
  @ApiOkResponse({ type: IdentifyEmailResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  identifyEmail(
    @Body(new ZodValidationPipe(identifyEmailSchema)) body: IdentifyEmailRequest,
  ): Promise<IdentifyEmailResponseDto> {
    return this.service.identifyEmail(body.email);
  }
}
