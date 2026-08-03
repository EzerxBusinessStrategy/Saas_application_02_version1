import { Inject, Injectable } from "@nestjs/common";
import { forbiddenPortal } from "../auth/auth-errors";
import { RequestContext } from "../auth/request-context";
import {
  PlatformConfigurationResponseDto,
  UpdatePlatformConfigurationRequest,
} from "./super-admin-platform-configuration.dto";
import {
  PlatformConfigurationRow,
  SuperAdminPlatformConfigurationRepository,
} from "./super-admin-platform-configuration.repository";

@Injectable()
export class SuperAdminPlatformConfigurationService {
  constructor(
    @Inject(SuperAdminPlatformConfigurationRepository)
    private readonly repository: SuperAdminPlatformConfigurationRepository,
  ) {}

  async get(context: RequestContext): Promise<PlatformConfigurationResponseDto> {
    this.assertPlatformContext(context);
    return toResponse(await this.repository.get(context));
  }

  async update(
    context: RequestContext,
    request: UpdatePlatformConfigurationRequest,
  ): Promise<PlatformConfigurationResponseDto> {
    this.assertPlatformContext(context);
    return toResponse(await this.repository.update(context, request));
  }

  private assertPlatformContext(context: RequestContext): void {
    if (!context.isPlatformAdmin || context.tenantId || context.membershipId) {
      throw forbiddenPortal();
    }
  }
}

function toResponse(rows: readonly PlatformConfigurationRow[]): PlatformConfigurationResponseDto {
  const values = new Map(rows.map((row) => [row.key, row.value]));
  return {
    platformName: values.get("platform_name") ?? "SaaS App",
    defaultBrand: values.get("default_brand_colour") ?? "#3C50E0",
    senderName: values.get("email_sender_name") ?? "SaaS App",
  };
}
