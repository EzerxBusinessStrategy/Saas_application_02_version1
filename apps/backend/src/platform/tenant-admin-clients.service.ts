import { Inject, Injectable } from "@nestjs/common";
import { RequestContext } from "../auth/request-context";
import { requireTenantAdminContext } from "./tenant-admin-context";
import {
  TenantAdminClientCreateInput,
  TenantAdminClientDetailDto,
  TenantAdminClientsQuery,
  TenantAdminClientsResponseDto,
  TenantAdminContactInput,
  TenantAdminClientContactDto,
} from "./tenant-admin-clients.dto";
import { TenantAdminClientsRepository } from "./tenant-admin-clients.repository";

@Injectable()
export class TenantAdminClientsService {
  constructor(
    @Inject(TenantAdminClientsRepository)
    private readonly repository: TenantAdminClientsRepository,
  ) {}

  list(context: RequestContext, query: TenantAdminClientsQuery): Promise<TenantAdminClientsResponseDto> {
    return this.repository.list(requireTenantAdminContext(context), query);
  }

  detail(context: RequestContext, clientRef: string): Promise<TenantAdminClientDetailDto> {
    return this.repository.detail(requireTenantAdminContext(context), clientRef);
  }

  create(context: RequestContext, input: TenantAdminClientCreateInput): Promise<TenantAdminClientDetailDto> {
    return this.repository.create(requireTenantAdminContext(context), input);
  }

  createContact(
    context: RequestContext,
    clientRef: string,
    input: TenantAdminContactInput,
  ): Promise<TenantAdminClientContactDto> {
    return this.repository.createContact(requireTenantAdminContext(context), clientRef, input);
  }

  updateContact(
    context: RequestContext,
    clientRef: string,
    contactId: string,
    input: TenantAdminContactInput,
  ): Promise<TenantAdminClientContactDto> {
    return this.repository.updateContact(requireTenantAdminContext(context), clientRef, contactId, input);
  }
}
