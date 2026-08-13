import { Inject, Injectable } from "@nestjs/common";
import { Pool, PoolClient } from "pg";
import { DATABASE_POOL } from "../../database/database.tokens";
import { databaseNotConfigured } from "../auth-errors";
import { PortalType } from "./portal-auth.types";

export type CredentialRecord = {
  readonly id: string;
  readonly portal_type: PortalType;
  readonly user_id: string;
  readonly tenant_id: string | null;
  readonly email_normalized: string;
  readonly password_hash: string | null;
  readonly status: string;
  readonly failed_login_attempts: number;
  readonly locked_until: Date | null;
  readonly user_status: string;
  readonly tenant_status: string | null;
};

export type ActiveSessionRecord = {
  readonly id: string;
  readonly portal_type: PortalType;
  readonly user_id: string;
  readonly tenant_id: string | null;
  readonly credential_id: string;
  readonly expires_at: Date;
  readonly idle_expires_at: Date | null;
};

@Injectable()
export class PortalAuthRepository {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool | null) {}

  async withTransaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
    if (!this.pool) throw databaseNotConfigured();
    const client = await this.pool.connect();
    try {
      await client.query("begin");
      await client.query("set local statement_timeout = '8s'");
      const result = await work(client);
      await client.query("commit");
      return result;
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  }

  async findCredentialForLogin(client: PoolClient, portalType: PortalType, email: string): Promise<CredentialRecord | undefined> {
    const result = await client.query<CredentialRecord>(
      `select c.id, c.portal_type, c.user_id, c.tenant_id, c.email_normalized, c.password_hash, c.status,
              c.failed_login_attempts, c.locked_until, u.status as user_status, t.status as tenant_status
       from authn.credentials c
       join public.users u on u.id = c.user_id
       left join public.tenants t on t.id = c.tenant_id
       where c.portal_type = $1 and c.email_normalized = $2
       for update of c`,
      [portalType, email],
    );
    return result.rows[0];
  }

  async recordLoginAudit(client: PoolClient, portalType: PortalType, email: string, outcome: string, credentialId: string | null, metadata: { ipAddress?: string; userAgent?: string }): Promise<void> {
    await client.query(
      `insert into authn.login_audit_events (portal_type, credential_id, email_normalized, outcome, ip_address, user_agent)
       values ($1, $2::uuid, $3, $4, nullif($5, '')::inet, nullif($6, ''))`,
      [portalType, credentialId, email, outcome, metadata.ipAddress ?? "", metadata.userAgent ?? ""],
    );
  }

  async recordFailedLogin(client: PoolClient, credential: CredentialRecord, metadata: { ipAddress?: string; userAgent?: string }): Promise<void> {
    const attempts = credential.failed_login_attempts + 1;
    const locked = attempts >= 5;
    await client.query(
      `update authn.credentials
       set failed_login_attempts = $2, locked_until = case when $3 then now() + interval '15 minutes' else locked_until end
       where id = $1`,
      [credential.id, attempts, locked],
    );
    await this.recordLoginAudit(client, credential.portal_type, credential.email_normalized, "INVALID_CREDENTIALS", credential.id, metadata);
  }

  async createSession(client: PoolClient, credential: CredentialRecord, tokenHash: string, expiresAt: Date, idleExpiresAt: Date | undefined, metadata: { ipAddress?: string; userAgent?: string }): Promise<string> {
    await client.query(
      `update authn.credentials set failed_login_attempts = 0, locked_until = null, last_login_at = now() where id = $1`,
      [credential.id],
    );
    await client.query(`update public.users set last_login_at = now(), updated_at = now() where id = $1`, [credential.user_id]);
    const result = await client.query<{ id: string }>(
      `insert into authn.sessions (portal_type, credential_id, user_id, tenant_id, token_hash, expires_at, idle_expires_at, ip_address, user_agent)
       values ($1, $2::uuid, $3::uuid, $4::uuid, $5, $6, $7, nullif($8, '')::inet, nullif($9, '')) returning id`,
      [credential.portal_type, credential.id, credential.user_id, credential.tenant_id, tokenHash, expiresAt, idleExpiresAt ?? null, metadata.ipAddress ?? "", metadata.userAgent ?? ""],
    );
    await this.recordLoginAudit(client, credential.portal_type, credential.email_normalized, "SUCCESS", credential.id, metadata);
    return result.rows[0]!.id;
  }

  async findActiveSession(portalType: PortalType, tokenHash: string): Promise<ActiveSessionRecord | undefined> {
    if (!this.pool) throw databaseNotConfigured();
    const result = await this.pool.query<ActiveSessionRecord>(
      `select s.id, s.portal_type, s.user_id, s.tenant_id, s.credential_id, s.expires_at, s.idle_expires_at
       from authn.sessions s
       join authn.credentials c on c.id = s.credential_id
       join public.users u on u.id = s.user_id
       left join public.tenants t on t.id = s.tenant_id
       where s.portal_type = $1 and s.token_hash = $2 and s.revoked_at is null and s.expires_at > now()
         and (s.idle_expires_at is null or s.idle_expires_at > now()) and c.status = 'ACTIVE'
         and u.status = 'active' and (s.tenant_id is null or t.status = 'active')`,
      [portalType, tokenHash],
    );
    const session = result.rows[0];
    if (session?.idle_expires_at) {
      await this.pool.query(
        `update authn.sessions set last_seen_at = now(), idle_expires_at = least(expires_at, now() + case when portal_type = 'SUPER_ADMIN' then interval '30 minutes' else interval '60 minutes' end)
         where id = $1::uuid and revoked_at is null`,
        [session.id],
      );
    }
    return session;
  }

  async revokeSession(portalType: PortalType, tokenHash: string): Promise<void> {
    if (!this.pool) throw databaseNotConfigured();
    await this.pool.query(
      `update authn.sessions set revoked_at = now() where portal_type = $1 and token_hash = $2 and revoked_at is null`,
      [portalType, tokenHash],
    );
  }
}
