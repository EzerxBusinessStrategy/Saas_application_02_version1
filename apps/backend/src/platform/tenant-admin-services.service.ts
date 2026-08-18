import { Inject, Injectable } from "@nestjs/common";
import { RequestContext } from "../auth/request-context";
import { requireTenantAdminContext } from "./tenant-admin-context";
import {
  TenantAdminServiceAllocationsResponseDto,
  TenantAdminServiceAllocationsQuery,
  TenantAdminServiceCreateRequest,
  TenantAdminServiceDto,
  TenantAdminServicesResponseDto,
  TenantAdminServiceStatusRequest,
  TenantAdminServiceStatusResponseDto,
  TenantAdminServiceTaskStatusRequest,
  TenantAdminServiceTaskStatusResponseDto,
} from "./tenant-admin-services.dto";
import { TenantAdminServicesRepository } from "./tenant-admin-services.repository";

@Injectable()
export class TenantAdminServicesService {
  constructor(
    @Inject(TenantAdminServicesRepository)
    private readonly repository: TenantAdminServicesRepository,
  ) {}

  async list(context: RequestContext): Promise<TenantAdminServicesResponseDto> {
    return { services: await this.repository.list(requireTenantAdminContext(context)) };
  }

  create(context: RequestContext, input: TenantAdminServiceCreateRequest): Promise<TenantAdminServiceDto> {
    return this.repository.create(requireTenantAdminContext(context), input);
  }

  setStatus(
    context: RequestContext,
    serviceId: string,
    input: TenantAdminServiceStatusRequest,
  ): Promise<TenantAdminServiceStatusResponseDto> {
    return this.repository.setServiceStatus(requireTenantAdminContext(context), serviceId, input.status);
  }

  setTaskStatus(
    context: RequestContext,
    serviceId: string,
    rateItemId: string,
    input: TenantAdminServiceTaskStatusRequest,
  ): Promise<TenantAdminServiceTaskStatusResponseDto> {
    return this.repository.setRateItemStatus(requireTenantAdminContext(context), serviceId, rateItemId, input.status);
  }

  getAllocations(
    context: RequestContext,
    serviceId: string,
    query: TenantAdminServiceAllocationsQuery,
  ): Promise<TenantAdminServiceAllocationsResponseDto> {
    return this.repository.getAllocations(requireTenantAdminContext(context), serviceId, query.rateItemId);
  }
}

