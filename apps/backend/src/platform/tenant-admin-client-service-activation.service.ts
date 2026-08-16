import { Inject, Injectable } from "@nestjs/common";
import { RequestContext } from "../auth/request-context";
import { requireTenantAdminContext } from "./tenant-admin-context";
import {
  ActivateClientServicesRequest,
  ActivateClientServicesResponseDto,
  ServiceOnboardingAssigneesResponseDto,
  ServiceOnboardingCatalogResponseDto,
} from "./tenant-admin-client-service-activation.dto";
import { TenantAdminClientServiceActivationRepository } from "./tenant-admin-client-service-activation.repository";

@Injectable()
export class TenantAdminClientServiceActivationService {
  constructor(
    @Inject(TenantAdminClientServiceActivationRepository)
    private readonly repository: TenantAdminClientServiceActivationRepository,
  ) {}

  getCatalog(context: RequestContext, clientId: string): Promise<ServiceOnboardingCatalogResponseDto> {
    return this.repository.getCatalog(requireTenantAdminContext(context), clientId);
  }

  listAssignees(context: RequestContext, clientId: string, serviceId: string): Promise<ServiceOnboardingAssigneesResponseDto> {
    return this.repository.listAssignees(requireTenantAdminContext(context), clientId, serviceId);
  }

  activate(
    context: RequestContext,
    clientId: string,
    input: ActivateClientServicesRequest,
  ): Promise<ActivateClientServicesResponseDto> {
    return this.repository.activate(requireTenantAdminContext(context), clientId, input);
  }
}
