import { Body, Controller, HttpCode, Inject, Post } from "@nestjs/common";
import { ApiBody, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
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
  @ApiOperation({ summary: "Resolve the login method without disclosing account existence." })
  @ApiBody({ type: IdentifyEmailRequestDto })
  @ApiOkResponse({ type: IdentifyEmailResponseDto })
  identifyEmail(
    @Body(new ZodValidationPipe(identifyEmailSchema)) body: IdentifyEmailRequest,
  ): Promise<IdentifyEmailResponseDto> {
    return this.service.identifyEmail(body.email);
  }
}
