import { Inject, Injectable } from "@nestjs/common";
import { RequestContextResolver, ResolvedRequestContext } from "./request-context-resolver.service";
import { TenantSelectionInput, VerifiedAuthUser } from "./request-context";

@Injectable()
export class ActiveRequestContextService {
  constructor(
    @Inject(RequestContextResolver) private readonly resolver: RequestContextResolver,
  ) {}

  async resolve(
    verifiedUser: VerifiedAuthUser,
    selection: TenantSelectionInput,
    requestId: string,
    ipAddress?: string,
  ): Promise<ResolvedRequestContext> {
    return this.resolver.resolve(verifiedUser, selection, requestId, ipAddress);
  }
}
