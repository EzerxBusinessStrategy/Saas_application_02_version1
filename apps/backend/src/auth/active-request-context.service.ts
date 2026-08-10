import { Inject, Injectable } from "@nestjs/common";
import { RequestContextResolver, ResolvedRequestContext } from "./request-context-resolver.service";
import { TenantSelectionInput, VerifiedAuthUser } from "./request-context";
import { SessionPolicyRepository } from "./session-policy.repository";

@Injectable()
export class ActiveRequestContextService {
  constructor(
    @Inject(RequestContextResolver) private readonly resolver: RequestContextResolver,
    @Inject(SessionPolicyRepository) private readonly sessionPolicies: SessionPolicyRepository,
  ) {}

  async resolve(
    verifiedUser: VerifiedAuthUser,
    selection: TenantSelectionInput,
    requestId: string,
  ): Promise<ResolvedRequestContext> {
    let resolved = await this.resolver.resolve(verifiedUser, selection, requestId);
    const session = await this.sessionPolicies.assertActive(resolved.context, verifiedUser.sessionId);

    if (resolved.authContextVersion !== session.auth_context_version) {
      resolved = await this.resolver.resolve(
        verifiedUser,
        selection,
        requestId,
        session.auth_context_version,
      );
    }

    return resolved;
  }
}
