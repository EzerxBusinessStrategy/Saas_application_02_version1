import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { Pool } from "pg";
import { formatConfigError, loadAppConfig } from "../config/app-config";
import {
  BootstrapSuperAdminService,
  maskEmail,
  PartialSuperAdminBootstrapError,
  PgSuperAdminBootstrapRepository,
  SupabaseAdminAuthClient,
} from "../auth/bootstrap-super-admin.service";

async function main(): Promise<void> {
  const config = loadAppConfig();
  const connectionString = config.databaseMigrationUrl;
  if (!connectionString) {
    throw new Error("BACKEND_DATABASE_MIGRATION_URL is required for Super Admin bootstrap.");
  }
  if (!config.supabaseUrl || !config.supabaseAdminKey) {
    throw new Error("BACKEND_SUPABASE_URL and BACKEND_SUPABASE_ADMIN_KEY are required.");
  }

  const input = await readBootstrapInput();

  const pool = new Pool({
    connectionString,
    max: 1,
    application_name: "saas-app-bootstrap-super-admin",
  });
  try {
    const service = new BootstrapSuperAdminService(
      new SupabaseAdminAuthClient(config.supabaseUrl, config.supabaseAdminKey),
      new PgSuperAdminBootstrapRepository(pool),
    );
    const result = await service.bootstrap(input);
    if (result.status === "already_exists") {
      output.write("First Super Admin has already been created. No account was changed.\n");
      output.write(`Masked email: ${maskEmail(result.email)}\n`);
      output.write(`Application user ID: ${result.applicationUserId}\n`);
      return;
    }

    output.write("First Super Admin created.\n");
    output.write(`Masked email: ${maskEmail(result.email)}\n`);
    output.write(`Supabase Auth user ID: ${result.authUserId}\n`);
    output.write(`Application user ID: ${result.applicationUserId}\n`);
    output.write(`Assigned role: ${result.assignedRole}\n`);
    output.write(`Tenant memberships created: ${result.tenantMembershipCount}\n`);
  } finally {
    await pool.end();
  }
}

async function readBootstrapInput(): Promise<{
  readonly fullName: string;
  readonly email: string;
  readonly password: string;
}> {
  const envInput = {
    fullName: process.env.BACKEND_BOOTSTRAP_SUPER_ADMIN_FULL_NAME?.trim(),
    email: process.env.BACKEND_BOOTSTRAP_SUPER_ADMIN_EMAIL?.trim(),
    password: process.env.BACKEND_BOOTSTRAP_SUPER_ADMIN_PASSWORD,
  };
  const provided = Object.values(envInput).filter((value) => value && value.length > 0).length;
  if (provided > 0) {
    if (!envInput.fullName || !envInput.email || !envInput.password) {
      throw new Error(
        "BACKEND_BOOTSTRAP_SUPER_ADMIN_FULL_NAME, BACKEND_BOOTSTRAP_SUPER_ADMIN_EMAIL, and BACKEND_BOOTSTRAP_SUPER_ADMIN_PASSWORD must be provided together.",
      );
    }
    return {
      fullName: envInput.fullName,
      email: envInput.email,
      password: envInput.password,
    };
  }

  const fullName = await readRequiredLine("Full name: ");
  const email = await readRequiredLine("Email: ");
  const password = await readHiddenLine("Password: ");
  const passwordConfirmation = await readHiddenLine("Confirm password: ");
  if (password !== passwordConfirmation) {
    throw new Error("Password confirmation does not match.");
  }
  return { fullName, email, password };
}

async function readRequiredLine(prompt: string): Promise<string> {
  const rl = createInterface({ input, output });
  try {
    const value = (await rl.question(prompt)).trim();
    if (!value) throw new Error(`${prompt.replace(":", "").trim()} is required.`);
    return value;
  } finally {
    rl.close();
  }
}

async function readHiddenLine(prompt: string): Promise<string> {
  if (!input.isTTY || !output.isTTY || !input.setRawMode) {
    throw new Error("Password input requires an interactive terminal.");
  }

  output.write(prompt);
  input.setRawMode(true);
  input.resume();
  input.setEncoding("utf8");

  return new Promise<string>((resolve, reject) => {
    let value = "";
    const cleanup = (): void => {
      input.off("data", onData);
      input.setRawMode(false);
      output.write("\n");
    };
    const onData = (chunk: string): void => {
      if (chunk === "\u0003") {
        cleanup();
        reject(new Error("Command cancelled."));
        return;
      }
      if (chunk === "\r" || chunk === "\n") {
        cleanup();
        if (!value) {
          reject(new Error(`${prompt.replace(":", "").trim()} is required.`));
          return;
        }
        resolve(value);
        return;
      }
      if (chunk === "\b" || chunk === "\u007f") {
        value = value.slice(0, -1);
        return;
      }
      value += chunk;
    };
    input.on("data", onData);
  });
}

void main().catch((error: unknown) => {
  if (error instanceof PartialSuperAdminBootstrapError) {
    process.stderr.write(`${error.message}\n`);
    process.stderr.write(`Masked email: ${maskEmail(error.email)}\n`);
    process.stderr.write(`Supabase Auth user ID: ${error.authUserId}\n`);
    process.exitCode = 1;
    return;
  }
  process.stderr.write(`${formatConfigError(error)}\n`);
  process.exitCode = 1;
});
