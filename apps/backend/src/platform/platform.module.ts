import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { DatabaseModule } from "../database/database.module";
import { ClientPortalNotificationsController } from "./client-portal-notifications.controller";
import { ClientPortalDeliverablesController } from "./client-portal-deliverables.controller";
import { ClientPortalDeliverablesRepository } from "./client-portal-deliverables.repository";
import { ClientPortalDeliverablesService } from "./client-portal-deliverables.service";
import { ClientPortalDashboardController } from "./client-portal-dashboard.controller";
import { ClientPortalDashboardRepository } from "./client-portal-dashboard.repository";
import { ClientPortalDashboardService } from "./client-portal-dashboard.service";
import { ClientPortalNotificationsRepository } from "./client-portal-notifications.repository";
import { ClientPortalNotificationsService } from "./client-portal-notifications.service";
import { ClientPortalProfileController } from "./client-portal-profile.controller";
import { ClientPortalProfileRepository } from "./client-portal-profile.repository";
import { ClientPortalProfileService } from "./client-portal-profile.service";
import { ClientPortalRequestsController } from "./client-portal-requests.controller";
import { ClientPortalRequestsRepository } from "./client-portal-requests.repository";
import { ClientPortalRequestsService } from "./client-portal-requests.service";
import { EmployeeDashboardController } from "./employee-dashboard.controller";
import { EmployeeDashboardRepository } from "./employee-dashboard.repository";
import { EmployeeDashboardService } from "./employee-dashboard.service";
import { EmployeeDocumentsController } from "./employee-documents.controller";
import { EmployeeDocumentsRepository } from "./employee-documents.repository";
import { EmployeeDocumentsService } from "./employee-documents.service";
import { EmployeeManagerController } from "./employee-manager.controller";
import { EmployeeManagerService } from "./employee-manager.service";
import { EmployeeNotificationsController } from "./employee-notifications.controller";
import { EmployeeNotificationsGateway } from "./employee-notifications.gateway";
import { EmployeeNotificationsRepository } from "./employee-notifications.repository";
import { EmployeeNotificationsService } from "./employee-notifications.service";
import { EmployeeProfileController } from "./employee-profile.controller";
import { EmployeeProfileRepository } from "./employee-profile.repository";
import { EmployeeProfileService } from "./employee-profile.service";
import { EmployeeTasksController } from "./employee-tasks.controller";
import { EmployeeTasksRepository } from "./employee-tasks.repository";
import { EmployeeTasksService } from "./employee-tasks.service";
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
import { TenantAdminFinanceController } from "./tenant-admin-finance.controller";
import { TenantAdminFinanceRepository } from "./tenant-admin-finance.repository";
import { TenantAdminFinanceService } from "./tenant-admin-finance.service";
import { TenantAdminNotificationsController } from "./tenant-admin-notifications.controller";
import { TenantAdminNotificationsGateway } from "./tenant-admin-notifications.gateway";
import { TenantAdminNotificationsListener } from "./tenant-admin-notifications-listener.service";
import { TenantAdminNotificationsRepository } from "./tenant-admin-notifications.repository";
import { TenantAdminNotificationsService } from "./tenant-admin-notifications.service";
import { TenantAdminServicesController } from "./tenant-admin-services.controller";
import { TenantAdminServicesRepository } from "./tenant-admin-services.repository";
import { TenantAdminServicesService } from "./tenant-admin-services.service";
import { TenantAdminTasksController } from "./tenant-admin-tasks.controller";
import { TenantAdminTasksRepository } from "./tenant-admin-tasks.repository";
import { TenantAdminTasksService } from "./tenant-admin-tasks.service";
import { TenantAnalyticsController } from "./tenant-analytics.controller";
import { TenantAnalyticsRepository } from "./tenant-analytics.repository";
import { TenantAnalyticsService } from "./tenant-analytics.service";
import { TenantSuspensionMaintenanceService } from "./tenant-suspension-maintenance.service";
import { TenantDocumentStorageService } from "./tenant-document-storage.service";
import { TaskNotificationOutboxWorker } from "./task-notification-outbox.worker";

@Module({
  imports: [AuthModule, DatabaseModule],
  controllers: [
    SuperAdminAuditLogController,
    SuperAdminDashboardController,
    SuperAdminSearchController,
    SuperAdminNotificationsController,
    SuperAdminPlatformConfigurationController,
    ClientPortalDashboardController,
    ClientPortalDeliverablesController,
    ClientPortalNotificationsController,
    ClientPortalProfileController,
    ClientPortalRequestsController,
    EmployeeDashboardController,
    EmployeeDocumentsController,
    EmployeeManagerController,
    EmployeeNotificationsController,
    EmployeeProfileController,
    EmployeeTasksController,
    TenantAdminDashboardController,
    TenantAdminClientsController,
    TenantAdminEmployeePerformanceController,
    TenantAdminFinanceController,
    TenantAdminNotificationsController,
    TenantAdminServicesController,
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
    ClientPortalDashboardRepository,
    ClientPortalDashboardService,
    ClientPortalDeliverablesRepository,
    ClientPortalDeliverablesService,
    ClientPortalNotificationsRepository,
    ClientPortalNotificationsService,
    ClientPortalProfileRepository,
    ClientPortalProfileService,
    ClientPortalRequestsRepository,
    ClientPortalRequestsService,
    EmployeeDashboardRepository,
    EmployeeDashboardService,
    EmployeeDocumentsRepository,
    EmployeeDocumentsService,
    EmployeeManagerService,
    EmployeeNotificationsRepository,
    EmployeeNotificationsService,
    EmployeeNotificationsGateway,
    EmployeeProfileRepository,
    EmployeeProfileService,
    EmployeeTasksRepository,
    EmployeeTasksService,
    TenantAdminDashboardRepository,
    TenantAdminDashboardService,
    TenantAdminClientsRepository,
    TenantAdminClientsService,
    TenantAdminEmployeePerformanceRepository,
    TenantAdminEmployeePerformanceService,
    TenantAdminFinanceRepository,
    TenantAdminFinanceService,
    TenantDocumentStorageService,
    TenantAdminNotificationsRepository,
    TenantAdminNotificationsService,
    TenantAdminNotificationsGateway,
    TenantAdminNotificationsListener,
    TenantAdminServicesRepository,
    TenantAdminServicesService,
    TenantAdminTasksRepository,
    TenantAdminTasksService,
    TenantAnalyticsRepository,
    TenantAnalyticsService,
    TenantSuspensionMaintenanceService,
    TaskNotificationOutboxWorker,
  ],
})
export class PlatformModule {}
