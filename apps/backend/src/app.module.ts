import { DynamicModule, Module } from "@nestjs/common";
import { APP_FILTER, APP_INTERCEPTOR } from "@nestjs/core";
import { AppConfig } from "./config/app-config";
import { AppConfigModule } from "./config/app-config.module";
import { ApiExceptionFilter } from "./common/errors/api-exception.filter";
import { CommonModule } from "./common/common.module";
import { RequestIdInterceptor } from "./common/request-id/request-id.interceptor";
import { DatabaseModule } from "./database/database.module";
import { HealthModule } from "./health/health.module";
import { AuthModule } from "./auth/auth.module";
import { PlatformModule } from "./platform/platform.module";

@Module({})
export class AppModule {
  static forRoot(config?: AppConfig): DynamicModule {
    return {
      module: AppModule,
      imports: [AppConfigModule.forRoot(config), CommonModule, DatabaseModule, HealthModule, AuthModule, PlatformModule],
      providers: [
        { provide: APP_FILTER, useClass: ApiExceptionFilter },
        { provide: APP_INTERCEPTOR, useClass: RequestIdInterceptor },
      ],
    };
  }
}
