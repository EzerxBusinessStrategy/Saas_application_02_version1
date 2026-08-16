import { Inject, Injectable } from "@nestjs/common";
import { RequestContext } from "../auth/request-context";
import { requireTenantAdminContext } from "./tenant-admin-context";
import {
  EmployeeServiceCapabilitiesResponseDto,
  ReplaceEmployeeServiceCapabilitiesRequest,
  ServiceBlueprintDto,
  UpsertServiceBlueprintRequest,
} from "./tenant-admin-service-blueprints.dto";
import { TenantAdminServiceBlueprintsRepository } from "./tenant-admin-service-blueprints.repository";

@Injectable()
export class TenantAdminServiceBlueprintsService {
  constructor(
    @Inject(TenantAdminServiceBlueprintsRepository)
    private readonly repository: TenantAdminServiceBlueprintsRepository,
  ) {}

  getBlueprint(context: RequestContext, serviceId: string): Promise<ServiceBlueprintDto> {
    return this.repository.getBlueprint(requireTenantAdminContext(context), serviceId);
  }

  upsertBlueprint(
    context: RequestContext,
    serviceId: string,
    input: UpsertServiceBlueprintRequest,
  ): Promise<ServiceBlueprintDto> {
    return this.repository.upsertBlueprint(requireTenantAdminContext(context), serviceId, input);
  }

  listEmployeeCapabilities(context: RequestContext, employeeId: string): Promise<EmployeeServiceCapabilitiesResponseDto> {
    return this.repository.listEmployeeCapabilities(requireTenantAdminContext(context), employeeId);
  }

  replaceEmployeeCapabilities(
    context: RequestContext,
    employeeId: string,
    input: ReplaceEmployeeServiceCapabilitiesRequest,
  ): Promise<EmployeeServiceCapabilitiesResponseDto> {
    return this.repository.replaceEmployeeCapabilities(requireTenantAdminContext(context), employeeId, input);
  }
}
