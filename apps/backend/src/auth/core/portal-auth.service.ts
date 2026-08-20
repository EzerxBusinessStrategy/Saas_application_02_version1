import { HttpException, HttpStatus, Inject, Injectable } from "@nestjs/common";
import { invalidAccessToken, invalidCredentials, tenantSuspended, userSuspended, workspaceNotAvailable } from "../auth-errors";
import { PortalLoginRequest, RequestMetadata, SwitchContextRequest } from "./portal-auth.dto";
import { OpaqueSessionTokenService } from "./opaque-session-token.service";
import { PasswordService } from "./password.service";
import { PortalAuthRepository, UserContextRow } from "./portal-auth.repository";
import { PortalType, portalRedirect, portalSessionPolicy } from "./portal-auth.types";
import { setTrustedDatabaseContext } from "../../database/transaction-context";

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

  async logout(portalType: PortalType, token: string, metadata: RequestMetadata): Promise<void> {
    await this.repository.revokeSession(portalType, this.tokens.hash(token), metadata);
  }

  async switchContext(
    userId: string,
    input: SwitchContextRequest,
    metadata: RequestMetadata,
  ): Promise<{ token: string; expiresAt: Date; redirect: string; portalType: PortalType }> {
    return this.repository.withTransaction(async (client) => {
      await setTrustedDatabaseContext(client, { userId });
      const contexts = await this.repository.listCurrentUserContexts(client);
      const target = resolveSwitchTarget(contexts, input);
      const credential = await this.repository.findActiveCredentialByUserId(client, userId);
      if (!credential || credential.user_status !== "active") throw userSuspended();
      if (credential.tenant_id && credential.tenant_status !== "active") throw tenantSuspended();
      const token = this.tokens.create();
      const policy = portalSessionPolicy(target.portalType);
      const expiresAt = new Date(Date.now() + policy.expiresInMs);
      const idleExpiresAt = policy.idleTimeoutMs ? new Date(Date.now() + policy.idleTimeoutMs) : undefined;
      await this.repository.createSession(
        client,
        credential,
        this.tokens.hash(token),
        expiresAt,
        idleExpiresAt,
        metadata,
        { portalType: target.portalType, tenantId: target.tenantId },
      );
      return { token, expiresAt, redirect: portalRedirect(target.portalType), portalType: target.portalType };
    });
  }
}

function resolveSwitchTarget(
  contexts: readonly UserContextRow[],
  input: SwitchContextRequest,
): { portalType: PortalType; tenantId: string | null } {
  if (input.workspace === "super-admin") {
    const platform = contexts.find((row) => row.context_type === "platform" && row.roles.includes("SUPER_ADMIN"));
    if (!platform) throw workspaceNotAvailable();
    return { portalType: "SUPER_ADMIN", tenantId: null };
  }

  const membership = contexts.find(
    (row) => row.context_type === "tenant" && row.tenant_id === input.tenantId,
  );
  if (!membership || !membership.tenant_id) throw workspaceNotAvailable();

  if (input.workspace === "admin") {
    const canAdmin = membership.roles.some((role) =>
      role === "TENANT_ADMIN" || role === "TENANT_OWNER" || role === "FINANCE_USER" || role === "HR_OPERATIONS_USER",
    );
    if (!canAdmin) throw workspaceNotAvailable();
    return { portalType: "TENANT", tenantId: membership.tenant_id };
  }

  if (input.workspace === "employee") {
    const canEmployee = membership.roles.some((role) => role === "EMPLOYEE" || role === "MANAGER");
    if (!canEmployee) throw workspaceNotAvailable();
    return { portalType: "EMPLOYEE", tenantId: membership.tenant_id };
  }

  const exhaustive: never = input.workspace;
  return exhaustive;
}
