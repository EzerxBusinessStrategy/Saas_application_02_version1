import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { DatabaseModule } from "../database/database.module";
import { SuperAdminAuditLogController } from "./super-admin-audit-log.controller";
import { SuperAdminAuditLogRepository } from "./super-admin-audit-log.repository";
import { SuperAdminAuditLogService } from "./super-admin-audit-log.service";
import { SuperAdminDashboardController } from "./super-admin-dashboard.controller";
import { SuperAdminDashboardRepository } from "./super-admin-dashboard.repository";
import { SuperAdminDashboardService } from "./super-admin-dashboard.service";
import { SuperAdminNotificationsController } from "./super-admin-notifications.controller";
import { SuperAdminNotificationsGateway } from "./super-admin-notifications.gateway";
import { SuperAdminNotificationsListener } from "./super-admin-notifications-listener.service";
import { SuperAdminNotificationsRepository } from "./super-admin-notifications.repository";
import { SuperAdminNotificationsService } from "./super-admin-notifications.service";
import { SuperAdminPlatformConfigurationController } from "./super-admin-platform-configuration.controller";
import { SuperAdminPlatformConfigurationRepository } from "./super-admin-platform-configuration.repository";
import { SuperAdminPlatformConfigurationService } from "./super-admin-platform-configuration.service";
import { SuperAdminSearchController } from "./super-admin-search.controller";
import { SuperAdminSearchRepository } from "./super-admin-search.repository";
import { SuperAdminSearchService } from "./super-admin-search.service";

@Module({
  imports: [AuthModule, DatabaseModule],
  controllers: [
    SuperAdminAuditLogController,
    SuperAdminDashboardController,
    SuperAdminSearchController,
    SuperAdminNotificationsController,
    SuperAdminPlatformConfigurationController,
  ],
  providers: [
    SuperAdminAuditLogRepository,
    SuperAdminAuditLogService,
    SuperAdminDashboardRepository,
    SuperAdminDashboardService,
    SuperAdminSearchRepository,
    SuperAdminSearchService,
    SuperAdminNotificationsRepository,
    SuperAdminNotificationsService,
    SuperAdminNotificationsGateway,
    SuperAdminNotificationsListener,
    SuperAdminPlatformConfigurationRepository,
    SuperAdminPlatformConfigurationService,
  ],
})
export class PlatformModule {}
