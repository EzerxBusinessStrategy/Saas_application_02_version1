import { readFileSync } from "node:fs";
const css = readFileSync("src/app/globals.css", "utf8");
const required = [
  "--primary",
  "--background",
  "--foreground",
  "--border",
  "--ring",
  "--sidebar",
  "--radius-card",
  "--shadow-card",
  "--header-height",
];
for (const token of required)
  if (!css.includes(token)) throw new Error(`Missing design token: ${token}`);
console.log(`Verified ${required.length} design tokens.`);
