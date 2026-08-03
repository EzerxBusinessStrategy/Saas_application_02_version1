import { Inject, Injectable } from "@nestjs/common";
import { forbiddenPortal } from "../auth/auth-errors";
import { RequestContext } from "../auth/request-context";
import {
  SuperAdminSearchQuery,
  SuperAdminSearchResponseDto,
} from "./super-admin-search.dto";
import { SuperAdminSearchRepository } from "./super-admin-search.repository";

@Injectable()
export class SuperAdminSearchService {
  constructor(
    @Inject(SuperAdminSearchRepository)
    private readonly repository: SuperAdminSearchRepository,
  ) {}

  async search(context: RequestContext, query: SuperAdminSearchQuery): Promise<SuperAdminSearchResponseDto> {
    if (!context.isPlatformAdmin || context.tenantId || context.membershipId) {
      throw forbiddenPortal();
    }

    const limit = query.limit ?? 10;
    const results = await this.repository.search(context, query);
    return {
      query: query.q?.trim() ?? "",
      limit,
      results,
    };
  }
}
