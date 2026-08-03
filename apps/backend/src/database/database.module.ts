import { Inject, Module, OnApplicationShutdown } from "@nestjs/common";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { APP_CONFIG, AppConfigModule } from "../config/app-config.module";
import { AppConfig } from "../config/app-config";
import { DATABASE_POOL, DRIZZLE_DB } from "./database.tokens";
import * as schema from "./schema";

@Module({
  imports: [AppConfigModule],
  providers: [
    {
      provide: DATABASE_POOL,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig): Pool | null => {
        if (!config.databaseUrl) {
          return null;
        }
        return new Pool({
          connectionString: config.databaseUrl,
          max: config.databasePoolMax,
          application_name: "saas-app-backend-api",
        });
      },
    },
    {
      provide: DRIZZLE_DB,
      inject: [DATABASE_POOL],
      useFactory: (pool: Pool | null) => (pool ? drizzle(pool, { schema }) : null),
    },
  ],
  exports: [DATABASE_POOL, DRIZZLE_DB],
})
export class DatabaseModule implements OnApplicationShutdown {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool | null) {}

  async onApplicationShutdown(): Promise<void> {
    await this.pool?.end();
  }
}
