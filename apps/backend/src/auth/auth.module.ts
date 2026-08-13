import { Module } from "@nestjs/common";
import { DatabaseModule } from "../database/database.module";
import { AccessAdminController } from "./access-admin.controller";
import { ActiveRequestContextService } from "./active-request-context.service";
import { AccessAdminRepository } from "./access-admin.repository";
import { AccessAdminService } from "./access-admin.service";
import { AuthContextRepository } from "./auth-context.repository";
import { ActiveRequestContextGuard } from "./guards/active-request-context.guard";
import { PermissionGuard } from "./guards/permission.guard";
import { SupabaseAuthGuard } from "./guards/supabase-auth.guard";
import { MeController } from "./me.controller";
import { MeService } from "./me.service";
import { RequestContextResolver } from "./request-context-resolver.service";
import { UserPreferencesRepository } from "./user-preferences.repository";
import { OpaqueSessionTokenService } from "./core/opaque-session-token.service";
import { PasswordService } from "./core/password.service";
import { PortalAuthRepository } from "./core/portal-auth.repository";
import { PortalAuthService } from "./core/portal-auth.service";
import { PortalAuthController } from "./portal-auth.controller";

@Module({
  imports: [DatabaseModule],
  controllers: [MeController, AccessAdminController, PortalAuthController],
  providers: [
    AccessAdminRepository,
    AccessAdminService,
    AuthContextRepository,
    OpaqueSessionTokenService,
    PasswordService,
    PortalAuthRepository,
    PortalAuthService,
    ActiveRequestContextGuard,
    ActiveRequestContextService,
    PermissionGuard,
    RequestContextResolver,
    SupabaseAuthGuard,
    UserPreferencesRepository,
    MeService,
  ],
  exports: [
    ActiveRequestContextGuard,
    ActiveRequestContextService,
    PermissionGuard,
    RequestContextResolver,
    PasswordService,
    PortalAuthService,
    SupabaseAuthGuard,
  ],
})
export class AuthModule {}
