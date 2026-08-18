import { Inject, Injectable } from "@nestjs/common";
import { RequestContext } from "../auth/request-context";
import { requireClientPortalContext } from "./client-portal-context";
import { requireTenantAdminContext } from "./tenant-admin-context";
import {
  AcceptClientServiceRequest,
  ClientServiceCatalogueQuery,
  ClientServiceCatalogueResponseDto,
  ClientServiceRequestDto,
  ClientServiceRequestListResponseDto,
  CreateClientServiceRequest,
  ListTenantServiceRequestsQuery,
  RejectClientServiceRequest,
} from "./client-service-requests.dto";
import { ClientServiceRequestsRepository } from "./client-service-requests.repository";

@Injectable()
export class ClientServiceRequestsService {
  constructor(
    @Inject(ClientServiceRequestsRepository)
    private readonly repository: ClientServiceRequestsRepository,
  ) {}

  getCatalogue(
    context: RequestContext,
    query: ClientServiceCatalogueQuery,
  ): Promise<ClientServiceCatalogueResponseDto> {
    return this.repository.getCatalogue(requireClientPortalContext(context), query);
  }

  async listForClient(context: RequestContext): Promise<ClientServiceRequestListResponseDto> {
    return {
      requests: await this.repository.listForClient(requireClientPortalContext(context)),
    };
  }

  create(context: RequestContext, input: CreateClientServiceRequest): Promise<ClientServiceRequestDto> {
    return this.repository.create(requireClientPortalContext(context), input);
  }

  async listForTenant(
    context: RequestContext,
    query: ListTenantServiceRequestsQuery,
  ): Promise<ClientServiceRequestListResponseDto> {
    return {
      requests: await this.repository.listForTenant(requireTenantAdminContext(context), query),
    };
  }

  getForTenant(context: RequestContext, requestId: string): Promise<ClientServiceRequestDto> {
    return this.repository.getForTenant(requireTenantAdminContext(context), requestId);
  }

  accept(
    context: RequestContext,
    requestId: string,
    input: AcceptClientServiceRequest,
  ): Promise<ClientServiceRequestDto> {
    return this.repository.accept(requireTenantAdminContext(context), requestId, input);
  }

  reject(
    context: RequestContext,
    requestId: string,
    input: RejectClientServiceRequest,
  ): Promise<ClientServiceRequestDto> {
    return this.repository.reject(requireTenantAdminContext(context), requestId, input);
  }
}
