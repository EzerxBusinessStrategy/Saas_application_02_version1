import { expect, test } from "vitest";
import { readSeenReleaseVersion, writeSeenReleaseVersion } from "@/lib/whats-new-seen";

test("stores the seen release version locally", () => {
  window.localStorage.clear();
  expect(readSeenReleaseVersion()).toBeNull();
  writeSeenReleaseVersion("0.1.0");
  expect(readSeenReleaseVersion()).toBe("0.1.0");
});
