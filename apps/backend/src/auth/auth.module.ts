import { Module } from "@nestjs/common";
import { DatabaseModule } from "../database/database.module";
import { AccessAdminController } from "./access-admin.controller";
import { ActiveRequestContextService } from "./active-request-context.service";
import { AccessAdminRepository } from "./access-admin.repository";
import { AccessAdminService } from "./access-admin.service";
import { AuthIdentifyController } from "./auth-identify.controller";
import { AuthIdentifyService } from "./auth-identify.service";
import { AuthContextRepository } from "./auth-context.repository";
import { ActiveRequestContextGuard } from "./guards/active-request-context.guard";
import { PermissionGuard } from "./guards/permission.guard";
import { SupabaseAuthGuard } from "./guards/supabase-auth.guard";
import { MeController } from "./me.controller";
import { MeService } from "./me.service";
import { RequestContextResolver } from "./request-context-resolver.service";
import { SessionPolicyController } from "./session-policy.controller";
import { SessionPolicyRepository } from "./session-policy.repository";
import { SupabaseJwtVerifier } from "./supabase-jwt-verifier.service";

@Module({
  imports: [DatabaseModule],
  controllers: [MeController, AccessAdminController, AuthIdentifyController, SessionPolicyController],
  providers: [
    AccessAdminRepository,
    AccessAdminService,
    AuthIdentifyService,
    AuthContextRepository,
    ActiveRequestContextGuard,
    ActiveRequestContextService,
    PermissionGuard,
    RequestContextResolver,
    SessionPolicyRepository,
    SupabaseAuthGuard,
    SupabaseJwtVerifier,
    MeService,
  ],
  exports: [
    ActiveRequestContextGuard,
    ActiveRequestContextService,
    PermissionGuard,
    RequestContextResolver,
    SessionPolicyRepository,
    SupabaseAuthGuard,
    SupabaseJwtVerifier,
  ],
})
export class AuthModule {}
