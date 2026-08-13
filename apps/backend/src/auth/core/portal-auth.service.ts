import { HttpException, HttpStatus, Inject, Injectable } from "@nestjs/common";
import { invalidAccessToken, invalidCredentials, tenantSuspended, userSuspended } from "../auth-errors";
import { PortalLoginRequest, RequestMetadata } from "./portal-auth.dto";
import { OpaqueSessionTokenService } from "./opaque-session-token.service";
import { PasswordService } from "./password.service";
import { PortalAuthRepository } from "./portal-auth.repository";
import { PortalType, portalRedirect, portalSessionPolicy } from "./portal-auth.types";

@Injectable()
export class PortalAuthService {
  constructor(
    @Inject(PortalAuthRepository) private readonly repository: PortalAuthRepository,
    @Inject(PasswordService) private readonly passwords: PasswordService,
    @Inject(OpaqueSessionTokenService) private readonly tokens: OpaqueSessionTokenService,
  ) {}

  async login(portalType: PortalType, input: PortalLoginRequest, metadata: RequestMetadata): Promise<{ token: string; expiresAt: Date; redirect: string }> {
    return this.repository.withTransaction(async (client) => {
      const credential = await this.repository.findCredentialForLogin(client, portalType, input.email);
      if (!credential) {
        await this.repository.recordLoginAudit(client, portalType, input.email, "INVALID_CREDENTIALS", null, metadata);
        throw invalidCredentials();
      }
      if (credential.locked_until && credential.locked_until > new Date()) {
        await this.repository.recordLoginAudit(client, portalType, input.email, "ACCOUNT_LOCKED", credential.id, metadata);
        throw new HttpException({ code: "ACCOUNT_LOCKED", message: "Account is temporarily locked." }, HttpStatus.LOCKED);
      }
      if (credential.status !== "ACTIVE" || credential.user_status !== "active") {
        await this.repository.recordLoginAudit(client, portalType, input.email, "ACCOUNT_SUSPENDED", credential.id, metadata);
        throw userSuspended();
      }
      if (credential.tenant_id && credential.tenant_status !== "active") {
        await this.repository.recordLoginAudit(client, portalType, input.email, "TENANT_SUSPENDED", credential.id, metadata);
        throw tenantSuspended();
      }
      if (!credential.password_hash || !(await this.passwords.verify(credential.password_hash, input.password))) {
        await this.repository.recordFailedLogin(client, credential, metadata);
        throw invalidCredentials();
      }
      const token = this.tokens.create();
      const policy = portalSessionPolicy(portalType);
      const expiresAt = new Date(Date.now() + policy.expiresInMs);
      const idleExpiresAt = policy.idleTimeoutMs ? new Date(Date.now() + policy.idleTimeoutMs) : undefined;
      await this.repository.createSession(client, credential, this.tokens.hash(token), expiresAt, idleExpiresAt, metadata);
      return { token, expiresAt, redirect: portalRedirect(portalType) };
    });
  }

  async resolveSession(portalType: PortalType, token: string) {
    const session = await this.repository.findActiveSession(portalType, this.tokens.hash(token));
    if (!session) throw invalidAccessToken();
    return session;
  }

  async logout(portalType: PortalType, token: string): Promise<void> {
    await this.repository.revokeSession(portalType, this.tokens.hash(token));
  }
}
