import { Inject, Injectable } from "@nestjs/common";
import { PasswordService } from "../auth/core/password.service";
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
    @Inject(PasswordService) private readonly passwords: PasswordService,
  ) {}

  list(context: RequestContext, query: TenantAdminClientsQuery): Promise<TenantAdminClientsResponseDto> {
    return this.repository.list(requireTenantAdminContext(context), query);
  }

  detail(context: RequestContext, clientRef: string): Promise<TenantAdminClientDetailDto> {
    return this.repository.detail(requireTenantAdminContext(context), clientRef);
  }

  archive(context: RequestContext, clientRef: string): Promise<void> {
    return this.repository.archive(requireTenantAdminContext(context), clientRef);
  }

  async create(context: RequestContext, input: TenantAdminClientCreateInput): Promise<TenantAdminClientDetailDto> {
    const tenantContext = requireTenantAdminContext(context);
    const email = input.portalAccess.email.trim().toLowerCase();
    return this.repository.create(tenantContext, {
      ...input,
      portalAccess: { ...input.portalAccess, email },
    }, await this.passwords.hash(input.portalAccess.password));
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
