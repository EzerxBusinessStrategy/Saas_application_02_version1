import { Controller, Get, Inject, Param, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { ActiveRequestContextGuard } from "../auth/guards/active-request-context.guard";
import { PermissionGuard } from "../auth/guards/permission.guard";
import { SupabaseAuthGuard } from "../auth/guards/supabase-auth.guard";
import { RequirePermissions } from "../auth/permissions.decorator";
import { CurrentRequestContext } from "../auth/request-context.decorator";
import { RequestContext } from "../auth/request-context";
import {
  EmployeePerformanceDetailDto,
  QueryEmployeePerformanceDto,
  TenantAdminEmployeePerformanceResponseDto,
} from "./tenant-admin-employee-performance.dto";
import { TenantAdminEmployeePerformanceService } from "./tenant-admin-employee-performance.service";

@ApiTags("Tenant Admin Employee Performance")
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard, ActiveRequestContextGuard, PermissionGuard)
@Controller("tenant-admin/employee-performance")
export class TenantAdminEmployeePerformanceController {
  constructor(
    @Inject(TenantAdminEmployeePerformanceService)
    private readonly service: TenantAdminEmployeePerformanceService,
  ) {}

  @Get()
  @RequirePermissions("employee.read")
  @ApiOperation({ summary: "Get tenant employee performance metrics and rankings" })
  @ApiResponse({ status: 200, type: TenantAdminEmployeePerformanceResponseDto })
  async getPerformanceList(
    @CurrentRequestContext() context: RequestContext,
    @Query() query: QueryEmployeePerformanceDto,
  ): Promise<TenantAdminEmployeePerformanceResponseDto> {
    return this.service.getPerformanceList(context, query);
  }

  @Get(":employeeId")
  @RequirePermissions("employee.read")
  @ApiOperation({ summary: "Get detailed employee performance and SLA history" })
  @ApiResponse({ status: 200, type: EmployeePerformanceDetailDto })
  async getEmployeeDetail(
    @CurrentRequestContext() context: RequestContext,
    @Param("employeeId") employeeId: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ): Promise<EmployeePerformanceDetailDto> {
    return this.service.getEmployeeDetail(context, employeeId, { from, to });
  }
}
