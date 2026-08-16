import { Body, Controller, Get, Inject, Param, Put, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { ActiveRequestContextGuard } from "../auth/guards/active-request-context.guard";
import { PermissionGuard } from "../auth/guards/permission.guard";
import { PortalSessionGuard } from "../auth/guards/portal-session.guard";
import { RequirePermissions } from "../auth/permissions.decorator";
import { CurrentRequestContext } from "../auth/request-context.decorator";
import { RequestContext } from "../auth/request-context";
import { ZodValidationPipe } from "../common/validation/zod-validation.pipe";
import {
  EmployeeServiceCapabilitiesResponseDto,
  replaceEmployeeServiceCapabilitiesSchema,
  ReplaceEmployeeServiceCapabilitiesRequest,
  ServiceBlueprintDto,
  upsertServiceBlueprintSchema,
  UpsertServiceBlueprintRequest,
} from "./tenant-admin-service-blueprints.dto";
import { TenantAdminServiceBlueprintsService } from "./tenant-admin-service-blueprints.service";

@ApiTags("Tenant Admin")
@ApiBearerAuth()
@Controller()
@UseGuards(PortalSessionGuard, ActiveRequestContextGuard, PermissionGuard)
export class TenantAdminServiceBlueprintsController {
  constructor(
    @Inject(TenantAdminServiceBlueprintsService)
    private readonly service: TenantAdminServiceBlueprintsService,
  ) {}

  @Get("tenant-admin/services/:serviceId/blueprint")
  @RequirePermissions("client.read")
  @ApiOperation({ summary: "Return the reusable task booklet for a tenant service." })
  @ApiOkResponse({ type: ServiceBlueprintDto })
  getBlueprint(
    @CurrentRequestContext() context: RequestContext,
    @Param("serviceId") serviceId: string,
  ): Promise<ServiceBlueprintDto> {
    return this.service.getBlueprint(context, serviceId);
  }

  @Put("tenant-admin/services/:serviceId/blueprint")
  @RequirePermissions("client.update")
  @ApiOperation({ summary: "Replace the reusable task booklet for a tenant service without changing existing clients." })
  @ApiOkResponse({ type: ServiceBlueprintDto })
  upsertBlueprint(
    @CurrentRequestContext() context: RequestContext,
    @Param("serviceId") serviceId: string,
    @Body(new ZodValidationPipe(upsertServiceBlueprintSchema)) body: UpsertServiceBlueprintRequest,
  ): Promise<ServiceBlueprintDto> {
    return this.service.upsertBlueprint(context, serviceId, body);
  }

  @Get("tenant-admin/employees/:employeeId/service-capabilities")
  @RequirePermissions("employee.read")
  @ApiOperation({ summary: "Return services an employee is capable of handling." })
  @ApiOkResponse({ type: EmployeeServiceCapabilitiesResponseDto })
  listCapabilities(
    @CurrentRequestContext() context: RequestContext,
    @Param("employeeId") employeeId: string,
  ): Promise<EmployeeServiceCapabilitiesResponseDto> {
    return this.service.listEmployeeCapabilities(context, employeeId);
  }

  @Put("tenant-admin/employees/:employeeId/service-capabilities")
  @RequirePermissions("employee.read")
  @ApiOperation({ summary: "Replace the services an employee is capable of handling." })
  @ApiOkResponse({ type: EmployeeServiceCapabilitiesResponseDto })
  replaceCapabilities(
    @CurrentRequestContext() context: RequestContext,
    @Param("employeeId") employeeId: string,
    @Body(new ZodValidationPipe(replaceEmployeeServiceCapabilitiesSchema)) body: ReplaceEmployeeServiceCapabilitiesRequest,
  ): Promise<EmployeeServiceCapabilitiesResponseDto> {
    return this.service.replaceEmployeeCapabilities(context, employeeId, body);
  }
}
