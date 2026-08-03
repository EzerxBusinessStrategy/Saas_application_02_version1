import { Inject, Injectable } from "@nestjs/common";
import { webcrypto } from "node:crypto";
import { APP_CONFIG } from "../config/app-config.module";
import { AppConfig } from "../config/app-config";
import { invalidAccessToken, authConfigurationMissing } from "./auth-errors";
import { VerifiedAuthUser } from "./request-context";

type JoseModule = typeof import("jose");
type JwksVerifier = ReturnType<JoseModule["createRemoteJWKSet"]>;
type SupabaseUserResponse = {
  readonly id?: string;
  readonly email?: string;
};
const importJose = new Function("specifier", "return import(specifier)") as (
  specifier: string,
) => Promise<JoseModule>;

@Injectable()
export class SupabaseJwtVerifier {
  private joseModule?: JoseModule;
  private jwksVerifier?: JwksVerifier;

  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  async verifyBearerToken(token: string): Promise<VerifiedAuthUser> {
    if (!this.config.supabaseJwtIssuer || !this.config.supabaseJwksUrl) {
      throw authConfigurationMissing();
    }

    try {
      const jose = await this.getJose();
      const decodedHeader = jose.decodeProtectedHeader(token);
      if (decodedHeader.alg === "HS256") {
        return await this.verifyLegacySupabaseToken(token, jose);
      }

      const { payload, protectedHeader } = await jose.jwtVerify(token, await this.getJwksVerifier(), {
        issuer: this.config.supabaseJwtIssuer,
        audience: this.config.supabaseJwtAudience ? [this.config.supabaseJwtAudience] : undefined,
        algorithms: ["ES256", "RS256"],
      });
      if (protectedHeader.alg !== "ES256" && protectedHeader.alg !== "RS256") {
        throw invalidAccessToken();
      }
      if (typeof payload.sub !== "string" || !isUuid(payload.sub)) {
        throw invalidAccessToken();
      }
      if (typeof payload.iss !== "string" || !payload.exp) {
        throw invalidAccessToken();
      }
      return verifiedUserFromPayload(payload);
    } catch (error) {
      if (isKnownAuthException(error)) throw error;
      throw invalidAccessToken();
    }
  }

  private async verifyLegacySupabaseToken(token: string, jose: JoseModule): Promise<VerifiedAuthUser> {
    if (!this.config.supabaseUrl || !this.config.supabaseAnonKey) {
      throw authConfigurationMissing();
    }

    const payload = jose.decodeJwt(token);
    if (!isExpectedPayload(payload, this.config)) {
      throw invalidAccessToken();
    }

    const response = await fetch(`${this.config.supabaseUrl.replace(/\/+$/, "")}/auth/v1/user`, {
      headers: {
        apikey: this.config.supabaseAnonKey,
        authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) throw invalidAccessToken();

    const user = (await response.json()) as SupabaseUserResponse;
    if (user.id !== payload.sub) throw invalidAccessToken();

    return verifiedUserFromPayload({
      ...payload,
      email: typeof payload.email === "string" ? payload.email : user.email,
    });
  }

  private async getJose(): Promise<JoseModule> {
    ensureWebCrypto();
    this.joseModule ??= await importJose("jose");
    return this.joseModule;
  }

  private async getJwksVerifier(): Promise<JwksVerifier> {
    if (!this.jwksVerifier) {
      const jose = await this.getJose();
      this.jwksVerifier = jose.createRemoteJWKSet(new URL(this.config.supabaseJwksUrl ?? ""), {
        timeoutDuration: this.config.supabaseJwksTimeoutMs,
        cooldownDuration: 30_000,
        cacheMaxAge: 10 * 60_000,
      });
    }
    return this.jwksVerifier;
  }
}

function ensureWebCrypto(): void {
  if (!globalThis.crypto) {
    Object.defineProperty(globalThis, "crypto", {
      value: webcrypto,
      configurable: true,
    });
  }
}

function normalizeAudience(audience: string | readonly string[] | undefined): readonly string[] {
  if (!audience) return [];
  if (typeof audience === "string") return [audience];
  return [...audience];
}

function verifiedUserFromPayload(payload: import("jose").JWTPayload): VerifiedAuthUser {
  if (typeof payload.sub !== "string" || !isUuid(payload.sub)) {
    throw invalidAccessToken();
  }
  if (typeof payload.iss !== "string" || !payload.exp) {
    throw invalidAccessToken();
  }
  return {
    authUserId: payload.sub,
    sessionId: typeof payload.session_id === "string" ? payload.session_id : undefined,
    email: typeof payload.email === "string" ? payload.email : undefined,
    issuer: payload.iss,
    audience: normalizeAudience(payload.aud),
    expiresAt: new Date(payload.exp * 1000),
  };
}

function isExpectedPayload(payload: import("jose").JWTPayload, config: AppConfig): boolean {
  if (typeof payload.sub !== "string" || !isUuid(payload.sub)) return false;
  if (payload.iss !== config.supabaseJwtIssuer) return false;
  if (config.supabaseJwtAudience && !normalizeAudience(payload.aud).includes(config.supabaseJwtAudience)) {
    return false;
  }
  if (typeof payload.exp !== "number" || payload.exp * 1000 <= Date.now()) return false;
  return true;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function isKnownAuthException(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "getStatus" in error &&
    typeof (error as { getStatus?: unknown }).getStatus === "function"
  );
}
