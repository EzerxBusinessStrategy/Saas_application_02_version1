import { Body, Controller, Delete, HttpCode, Inject, Post, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiCreatedResponse, ApiTags } from "@nestjs/swagger";
import { FastifyRequest } from "fastify";
import { REQUEST_ID_HEADER, resolveRequestId } from "../common/request-id/request-id";
import { ZodValidationPipe } from "../common/validation/zod-validation.pipe";
import { authenticationRequired, sessionExpired } from "./auth-errors";
import { SupabaseAuthGuard } from "./guards/supabase-auth.guard";
import { AuthenticatedRequest } from "./request-context";
import { tenantSelectionFromRequest } from "./tenant-selection";
import { RequestContextResolver } from "./request-context-resolver.service";
import {
  CreateSessionPolicyRequest,
  createSessionPolicySchema,
  SessionPolicyResponseDto,
} from "./session-policy.dto";
import { SessionPolicyRepository } from "./session-policy.repository";

@ApiTags("auth")
@ApiBearerAuth()
@Controller("auth/session-policy")
@UseGuards(SupabaseAuthGuard)
export class SessionPolicyController {
  constructor(
    @Inject(RequestContextResolver) private readonly resolver: RequestContextResolver,
    @Inject(SessionPolicyRepository) private readonly repository: SessionPolicyRepository,
  ) {}

  @Post()
  @ApiCreatedResponse({ type: SessionPolicyResponseDto })
  async create(
    @Req() request: FastifyRequest & AuthenticatedRequest,
    @Body(new ZodValidationPipe(createSessionPolicySchema)) body: CreateSessionPolicyRequest,
  ): Promise<SessionPolicyResponseDto> {
    if (!request.verifiedAuthUser) throw authenticationRequired();
    if (!request.verifiedAuthUser.sessionId) throw sessionExpired();

    const resolved = await this.resolver.resolve(
      request.verifiedAuthUser,
      tenantSelectionFromRequest(request),
      resolveRequestId(request.headers[REQUEST_ID_HEADER], request.id),
    );
    const policy = await this.repository.createOrRefresh(
      resolved.context,
      request.verifiedAuthUser.sessionId,
      body.rememberMe,
    );

    return {
      rememberMe: policy.remember_me,
      absoluteExpiresAt: policy.absolute_expires_at.toISOString(),
    };
  }

  @Delete()
  @HttpCode(204)
  async revoke(@Req() request: FastifyRequest & AuthenticatedRequest): Promise<void> {
    if (!request.verifiedAuthUser) throw authenticationRequired();
    const resolved = await this.resolver.resolve(
      request.verifiedAuthUser,
      tenantSelectionFromRequest(request),
      resolveRequestId(request.headers[REQUEST_ID_HEADER], request.id),
    );
    await this.repository.revoke(resolved.context, request.verifiedAuthUser.sessionId);
  }
}
