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
import { TenantAdminDashboardController } from "./tenant-admin-dashboard.controller";
import { TenantAdminDashboardRepository } from "./tenant-admin-dashboard.repository";
import { TenantAdminDashboardService } from "./tenant-admin-dashboard.service";
import { TenantAdminClientsController } from "./tenant-admin-clients.controller";
import { TenantAdminClientsRepository } from "./tenant-admin-clients.repository";
import { TenantAdminClientsService } from "./tenant-admin-clients.service";
import { TenantAdminEmployeePerformanceController } from "./tenant-admin-employee-performance.controller";
import { TenantAdminEmployeePerformanceRepository } from "./tenant-admin-employee-performance.repository";
import { TenantAdminEmployeePerformanceService } from "./tenant-admin-employee-performance.service";
import { TenantAdminNotificationsController } from "./tenant-admin-notifications.controller";
import { TenantAdminNotificationsGateway } from "./tenant-admin-notifications.gateway";
import { TenantAdminNotificationsListener } from "./tenant-admin-notifications-listener.service";
import { TenantAdminNotificationsRepository } from "./tenant-admin-notifications.repository";
import { TenantAdminNotificationsService } from "./tenant-admin-notifications.service";
import { TenantAdminTasksController } from "./tenant-admin-tasks.controller";
import { TenantAdminTasksRepository } from "./tenant-admin-tasks.repository";
import { TenantAdminTasksService } from "./tenant-admin-tasks.service";
import { TenantAnalyticsController } from "./tenant-analytics.controller";
import { TenantAnalyticsRepository } from "./tenant-analytics.repository";
import { TenantAnalyticsService } from "./tenant-analytics.service";

@Module({
  imports: [AuthModule, DatabaseModule],
  controllers: [
    SuperAdminAuditLogController,
    SuperAdminDashboardController,
    SuperAdminSearchController,
    SuperAdminNotificationsController,
    SuperAdminPlatformConfigurationController,
    TenantAdminDashboardController,
    TenantAdminClientsController,
    TenantAdminEmployeePerformanceController,
    TenantAdminNotificationsController,
    TenantAdminTasksController,
    TenantAnalyticsController,
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
    TenantAdminDashboardRepository,
    TenantAdminDashboardService,
    TenantAdminClientsRepository,
    TenantAdminClientsService,
    TenantAdminEmployeePerformanceRepository,
    TenantAdminEmployeePerformanceService,
    TenantAdminNotificationsRepository,
    TenantAdminNotificationsService,
    TenantAdminNotificationsGateway,
    TenantAdminNotificationsListener,
    TenantAdminTasksRepository,
    TenantAdminTasksService,
    TenantAnalyticsRepository,
    TenantAnalyticsService,
  ],
})
export class PlatformModule {}
