import { ConflictException, Inject, Injectable, ServiceUnavailableException } from "@nestjs/common";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { APP_CONFIG } from "../config/app-config.module";
import { AppConfig } from "../config/app-config";
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
    @Inject(APP_CONFIG) private readonly config: AppConfig,
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
    if (!this.config.supabaseUrl || !this.config.supabaseAdminKey) {
      throw new ServiceUnavailableException({
        code: "AUTH_PROVISIONING_UNAVAILABLE",
        message: "Client portal account provisioning is unavailable.",
      });
    }
    const email = input.portalAccess.email.trim().toLowerCase();
    const client = createSupabaseClient(this.config.supabaseUrl, this.config.supabaseAdminKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data, error } = await client.auth.admin.createUser({
      email,
      password: input.portalAccess.password,
      email_confirm: true,
      user_metadata: {
        full_name: input.primaryContact?.name || input.displayName,
        portal: "client",
      },
    });
    if (error || !data.user) {
      throw new ConflictException({
        code: "CLIENT_PORTAL_EMAIL_EXISTS",
        message: "This email is already associated with an existing account.",
      });
    }
    try {
      return await this.repository.create(tenantContext, {
        ...input,
        portalAccess: { ...input.portalAccess, email },
      }, data.user.id);
    } catch (provisioningError) {
      await client.auth.admin.deleteUser(data.user.id).catch(() => undefined);
      throw provisioningError;
    }
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
