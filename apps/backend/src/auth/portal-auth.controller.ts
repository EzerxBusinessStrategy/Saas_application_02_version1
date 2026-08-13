import { Body, Controller, Get, HttpCode, Post, Req, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { FastifyRequest } from "fastify";
import { ZodValidationPipe } from "../common/validation/zod-validation.pipe";
import { PortalAuthService } from "./core/portal-auth.service";
import { portalLoginSchema, PortalLoginRequest } from "./core/portal-auth.dto";
import { PortalType } from "./core/portal-auth.types";
import { portalSessionCookieName } from "./auth-cookie-names";
import { SupabaseAuthGuard } from "./guards/supabase-auth.guard";
import { AuthenticatedRequest } from "./request-context";

@ApiTags("portal-auth")
@Controller("auth")
export class PortalAuthController {
  constructor(private readonly auth: PortalAuthService) {}

  @Post("super-admin/login")
  loginSuperAdmin(@Req() request: FastifyRequest, @Body(new ZodValidationPipe(portalLoginSchema)) body: PortalLoginRequest) {
    return this.login("SUPER_ADMIN", request, body);
  }

  @Post("tenant/login")
  loginTenant(@Req() request: FastifyRequest, @Body(new ZodValidationPipe(portalLoginSchema)) body: PortalLoginRequest) {
    return this.login("TENANT", request, body);
  }

  @Post("employee/login")
  loginEmployee(@Req() request: FastifyRequest, @Body(new ZodValidationPipe(portalLoginSchema)) body: PortalLoginRequest) {
    return this.login("EMPLOYEE", request, body);
  }

  @Post("client/login")
  loginClient(@Req() request: FastifyRequest, @Body(new ZodValidationPipe(portalLoginSchema)) body: PortalLoginRequest) {
    return this.login("CLIENT", request, body);
  }

  @Get("super-admin/session")
  @UseGuards(SupabaseAuthGuard)
  superAdminSession(@Req() request: FastifyRequest & AuthenticatedRequest) { return sessionResponse("SUPER_ADMIN", request); }

  @Get("tenant/session")
  @UseGuards(SupabaseAuthGuard)
  tenantSession(@Req() request: FastifyRequest & AuthenticatedRequest) { return sessionResponse("TENANT", request); }

  @Get("employee/session")
  @UseGuards(SupabaseAuthGuard)
  employeeSession(@Req() request: FastifyRequest & AuthenticatedRequest) { return sessionResponse("EMPLOYEE", request); }

  @Get("client/session")
  @UseGuards(SupabaseAuthGuard)
  clientSession(@Req() request: FastifyRequest & AuthenticatedRequest) { return sessionResponse("CLIENT", request); }

  @Post("super-admin/logout")
  @HttpCode(204)
  @UseGuards(SupabaseAuthGuard)
  logoutSuperAdmin(@Req() request: FastifyRequest) { return this.logout("SUPER_ADMIN", request); }

  @Post("tenant/logout")
  @HttpCode(204)
  @UseGuards(SupabaseAuthGuard)
  logoutTenant(@Req() request: FastifyRequest) { return this.logout("TENANT", request); }

  @Post("employee/logout")
  @HttpCode(204)
  @UseGuards(SupabaseAuthGuard)
  logoutEmployee(@Req() request: FastifyRequest) { return this.logout("EMPLOYEE", request); }

  @Post("client/logout")
  @HttpCode(204)
  @UseGuards(SupabaseAuthGuard)
  logoutClient(@Req() request: FastifyRequest) { return this.logout("CLIENT", request); }

  private login(portalType: PortalType, request: FastifyRequest, body: PortalLoginRequest) {
    return this.auth.login(portalType, body, { ipAddress: request.ip, userAgent: request.headers["user-agent"] });
  }

  private async logout(portalType: PortalType, request: FastifyRequest): Promise<void> {
    const token = portalCookie(request.headers.cookie, portalType);
    if (token) await this.auth.logout(portalType, token);
  }
}

function sessionResponse(portalType: PortalType, request: FastifyRequest & AuthenticatedRequest) {
  if (request.verifiedAuthUser?.portalType !== portalType) {
    return { active: false };
  }
  return { active: true, portalType, userId: request.verifiedAuthUser.authUserId };
}

function portalCookie(cookie: string | undefined, portal: PortalType): string | undefined {
  const name = portalSessionCookieName(portal);
  for (const part of cookie?.split(";") ?? []) {
    const [key, ...value] = part.trim().split("=");
    if (key === name && value.length) return decodeURIComponent(value.join("="));
  }
  return undefined;
}
