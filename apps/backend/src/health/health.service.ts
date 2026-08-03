import { Inject, Injectable } from "@nestjs/common";
import { Pool } from "pg";
import { APP_CONFIG } from "../config/app-config.module";
import { AppConfig } from "../config/app-config";
import { DATABASE_POOL } from "../database/database.tokens";
import { LiveHealthResponseDto, ReadyHealthResponseDto } from "./health.dto";

@Injectable()
export class HealthService {
  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(DATABASE_POOL) private readonly pool: Pool | null,
  ) {}

  live(): LiveHealthResponseDto {
    return {
      status: "ok",
      service: this.config.appName,
      timestamp: new Date().toISOString(),
    };
  }

  async ready(): Promise<ReadyHealthResponseDto> {
    const database = await this.databaseCheck();
    return {
      status: database.status === "down" ? "degraded" : "ready",
      service: this.config.appName,
      checks: [{ name: "configuration", status: "up" }],
      dependencies: [database],
      timestamp: new Date().toISOString(),
    };
  }

  private async databaseCheck(): Promise<{ name: string; status: string }> {
    if (!this.pool) {
      return { name: "database", status: "not_configured" };
    }
    try {
      await this.pool.query("select 1");
      return { name: "database", status: "up" };
    } catch {
      return { name: "database", status: "down" };
    }
  }
}
