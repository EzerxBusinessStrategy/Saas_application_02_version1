import { expect, test } from "vitest";
import packageJson from "../../package.json";
import { APP_VERSION } from "@/lib/app-version";
import { RELEASES } from "@/lib/release-log";

test("APP_VERSION matches package.json", () => {
  expect(APP_VERSION).toBe(packageJson.version);
});

test("release log lists the current version first", () => {
  expect(RELEASES[0]?.version).toBe(APP_VERSION);
});
