import { readFileSync } from "node:fs";
import { join } from "node:path";

interface Messages {
  readonly [key: string]: string | Messages;
}

function readMessages(locale: string): Messages {
  return JSON.parse(readFileSync(join(process.cwd(), "messages", `${locale}.json`), "utf8")) as Messages;
}

function keysOf(messages: Messages, prefix = ""): string[] {
  return Object.entries(messages).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof value === "string" ? [path] : keysOf(value, path);
  });
}

const englishKeys = keysOf(readMessages("en"));
const missing = ["bn", "hi", "or"].flatMap((locale) => {
  const keys = new Set(keysOf(readMessages(locale)));
  return englishKeys.filter((key) => !keys.has(key)).map((key) => `${locale}: ${key}`);
});

if (missing.length) {
  throw new Error(`Translation validation failed:\n${missing.join("\n")}`);
}
