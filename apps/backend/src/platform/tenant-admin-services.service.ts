import { Inject, Injectable } from "@nestjs/common";
import { RequestContext } from "../auth/request-context";
import { requireTenantAdminContext } from "./tenant-admin-context";
import {
  TenantAdminServiceCreateRequest,
  TenantAdminServiceDto,
  TenantAdminServicesResponseDto,
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

  setTaskStatus(
    context: RequestContext,
    serviceId: string,
    rateItemId: string,
    input: TenantAdminServiceTaskStatusRequest,
  ): Promise<TenantAdminServiceTaskStatusResponseDto> {
    return this.repository.setRateItemStatus(requireTenantAdminContext(context), serviceId, rateItemId, input.status);
  }
}

