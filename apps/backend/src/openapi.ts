import { INestApplication } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppConfig } from "./config/app-config";
import { ApiErrorResponseDto } from "./common/errors/api-error.dto";

export function setupOpenApi(app: INestApplication, config: AppConfig): void {
  const apiPath = config.apiBasePath.replace(/^\//, "");
  const documentConfig = new DocumentBuilder()
    .setTitle(config.appName)
    .setDescription("Backend foundation, identity, and access-administration endpoints.")
    .setVersion("0.1.0")
    .addServer(config.apiBasePath)
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, documentConfig, {
    extraModels: [ApiErrorResponseDto],
  });

  SwaggerModule.setup(`${apiPath}/docs`, app, document, {
    jsonDocumentUrl: `${config.apiBasePath}/docs-json`,
  });
}
