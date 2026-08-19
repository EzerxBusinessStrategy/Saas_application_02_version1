import { BadRequestException, Inject, Injectable, ServiceUnavailableException } from "@nestjs/common";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { APP_CONFIG } from "../config/app-config.module";
import type { AppConfig } from "../config/app-config";
import {
  AVATAR_BUCKET,
  AVATAR_CONTENT_TYPE,
  AVATAR_SIGNED_URL_TTL_SECONDS,
  MAX_AVATAR_BYTES,
  isOwnedAvatarPath,
  isWebpImage,
} from "./user-avatar.util";

@Injectable()
export class UserAvatarStorageService {
  private readonly client: SupabaseClient | null;

  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    this.client = config.supabaseUrl && config.supabaseAdminKey
      ? createClient(config.supabaseUrl, config.supabaseAdminKey, {
          auth: {
            autoRefreshToken: false,
            detectSessionInUrl: false,
            persistSession: false,
            skipAutoInitialize: true,
          },
        })
      : null;
  }

  async uploadWebp(objectKey: string, bytes: Uint8Array): Promise<void> {
    assertAvatarBytes(bytes);
    const { error } = await this.requireClient().storage.from(AVATAR_BUCKET).upload(objectKey, bytes, {
      contentType: AVATAR_CONTENT_TYPE,
      upsert: false,
    });
    if (error) {
      throw new ServiceUnavailableException({
        code: "AVATAR_STORAGE_UNAVAILABLE",
        message: "Profile photo storage is temporarily unavailable. Please try again.",
      });
    }
  }

  async createSignedUrl(objectKey: string, userId: string): Promise<string> {
    if (!isOwnedAvatarPath(objectKey, userId)) {
      throw new BadRequestException({
        code: "AVATAR_PATH_INVALID",
        message: "The stored profile photo could not be loaded.",
      });
    }
    const { data, error } = await this.requireClient().storage
      .from(AVATAR_BUCKET)
      .createSignedUrl(objectKey, AVATAR_SIGNED_URL_TTL_SECONDS);
    if (error || !data?.signedUrl) {
      throw new ServiceUnavailableException({
        code: "AVATAR_DOWNLOAD_UNAVAILABLE",
        message: "The profile photo is temporarily unavailable. Please try again.",
      });
    }
    return data.signedUrl;
  }

  async removeObject(objectKey: string): Promise<void> {
    await this.requireClient().storage.from(AVATAR_BUCKET).remove([objectKey]);
  }

  private requireClient(): SupabaseClient {
    if (!this.client) {
      throw new ServiceUnavailableException({
        code: "AVATAR_STORAGE_UNAVAILABLE",
        message: "Profile photo storage is not configured.",
      });
    }
    return this.client;
  }
}

function assertAvatarBytes(bytes: Uint8Array): void {
  if (bytes.byteLength < 16 || bytes.byteLength > MAX_AVATAR_BYTES) {
    throw new BadRequestException({
      code: "AVATAR_SIZE_INVALID",
      message: "Use a profile photo up to 1 MB after cropping.",
    });
  }
  if (!isWebpImage(bytes)) {
    throw new BadRequestException({
      code: "AVATAR_TYPE_INVALID",
      message: "Profile photos must be exported as WebP.",
    });
  }
}
