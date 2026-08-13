import { expect, test } from "vitest";
import { POST } from "@/app/api/auth/identify/route";

test("retires the unified identify endpoint", async () => {
  const response = await POST();

  expect(response.status).toBe(410);
  await expect(response.json()).resolves.toEqual({ message: "Use a portal-specific sign-in endpoint." });
});
