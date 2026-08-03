import { DynamicModule, Global, Module } from "@nestjs/common";
import { AppConfig, loadAppConfig } from "./app-config";

export const APP_CONFIG = Symbol("APP_CONFIG");

@Global()
@Module({})
export class AppConfigModule {
  static forRoot(config: AppConfig = loadAppConfig()): DynamicModule {
    return {
      module: AppConfigModule,
      providers: [{ provide: APP_CONFIG, useValue: config }],
      exports: [APP_CONFIG],
    };
  }
}
