import { createBackendApp } from "./bootstrap";
import { formatConfigError, loadAppConfig } from "./config/app-config";

async function bootstrap(): Promise<void> {
  const config = loadAppConfig();
  const app = await createBackendApp(config);

  await app.listen(config.port, "0.0.0.0");
}

void bootstrap().catch((error: unknown) => {
  process.stderr.write(`Backend startup failed: ${formatConfigError(error)}\n`);
  process.exitCode = 1;
});
