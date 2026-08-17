import { Inject, Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from "@nestjs/common";
import { Pool } from "pg";
import { DATABASE_POOL } from "../database/database.tokens";

const EXPIRY_INTERVAL_MS = 60_000;

@Injectable()
export class TaskFeedbackExpiryWorker implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(TaskFeedbackExpiryWorker.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool | null) {}

  onApplicationBootstrap(): void {
    if (!this.pool) return;
    void this.flush();
    this.timer = setInterval(() => void this.flush(), EXPIRY_INTERVAL_MS);
    this.timer.unref();
  }

  onApplicationShutdown(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private async flush(): Promise<void> {
    if (!this.pool || this.running) return;
    this.running = true;
    try {
      const result = await this.pool.query<{ expire_unanswered_client_task_feedback: number }>(
        "select private.expire_unanswered_client_task_feedback()",
      );
      const expired = result.rows[0]?.expire_unanswered_client_task_feedback ?? 0;
      if (expired > 0) {
        this.logger.log(`Recorded ${expired} unanswered task feedback log row(s) after the 60-day window.`);
      }
    } catch (error) {
      if (isMissingRelation(error)) return;
      this.logger.error(
        "Unable to expire unanswered client task feedback.",
        error instanceof Error ? error.stack : undefined,
      );
    } finally {
      this.running = false;
    }
  }
}

function isMissingRelation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error.code === "42P01" || error.code === "42883")
  );
}
