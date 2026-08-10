import { Inject, Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from "@nestjs/common";
import { Pool } from "pg";
import { DATABASE_POOL } from "../database/database.tokens";

const RESTORE_INTERVAL_MS = 60_000;

@Injectable()
export class TenantSuspensionMaintenanceService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(TenantSuspensionMaintenanceService.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool | null) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.restoreExpiredSuspensions();
    if (!this.pool) return;
    this.timer = setInterval(() => void this.restoreExpiredSuspensions(), RESTORE_INTERVAL_MS);
    this.timer.unref();
  }

  onApplicationShutdown(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private async restoreExpiredSuspensions(): Promise<void> {
    if (!this.pool || this.running) return;
    this.running = true;
    try {
      const result = await this.pool.query<{ restored_count: number }>(
        "select private.restore_all_expired_tenant_suspensions() as restored_count",
      );
      const restored = result.rows[0]?.restored_count ?? 0;
      if (restored > 0) this.logger.log(`Restored ${restored} expired tenant suspension(s).`);
    } catch (error) {
      this.logger.error(
        "Unable to restore expired tenant suspensions during scheduled maintenance.",
        error instanceof Error ? error.stack : undefined,
      );
    } finally {
      this.running = false;
    }
  }
}
