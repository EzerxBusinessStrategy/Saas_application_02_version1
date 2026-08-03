import { Inject, Injectable } from "@nestjs/common";
import { forbiddenPortal } from "../auth/auth-errors";
import { RequestContext } from "../auth/request-context";
import { AuditLogQuery, AuditLogResponseDto } from "./super-admin-audit-log.dto";
import { AuditLogRow, SuperAdminAuditLogRepository } from "./super-admin-audit-log.repository";

@Injectable()
export class SuperAdminAuditLogService {
  constructor(
    @Inject(SuperAdminAuditLogRepository)
    private readonly repository: SuperAdminAuditLogRepository,
  ) {}

  async list(context: RequestContext, query: AuditLogQuery): Promise<AuditLogResponseDto> {
    if (!context.isPlatformAdmin || context.tenantId || context.membershipId) throw forbiddenPortal();
    const result = await this.repository.list(context, query);
    return {
      items: result.rows.map(mapAuditRow),
      page: query.page,
      pageSize: query.pageSize,
      pageCount: Math.max(1, Math.ceil(result.totalItems / query.pageSize)),
      totalItems: result.totalItems,
    };
  }
}

function mapAuditRow(row: AuditLogRow) {
  return {
    id: row.id,
    actor: row.actor ?? "System",
    tenant: row.tenant ?? "Platform",
    action: row.action,
    resource: row.resource,
    timestamp: row.timestamp.toISOString(),
    ipAddress: row.ip_address ?? "",
    reason: row.reason,
    result:
      row.result === "succeeded"
        ? "success"
        : row.result === "denied"
          ? "denied"
          : row.result === "failed"
            ? "failed"
            : "pending",
    detail: row.detail ?? "",
  } as const;
}
