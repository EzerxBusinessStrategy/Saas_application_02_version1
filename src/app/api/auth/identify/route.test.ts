import { afterEach, expect, test, vi } from "vitest";
import { POST } from "@/app/api/auth/identify/route";

afterEach(() => {
  vi.unstubAllGlobals();
});

test("continues to the password step without waiting for the advisory identify API", async () => {
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);

  const response = await POST(
    new Request("http://localhost/api/auth/identify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "superadmin@abc.com" }),
    }),
  );

  expect(response.status).toBe(200);
  await expect(response.json()).resolves.toEqual({ method: "password" });
  expect(fetchMock).not.toHaveBeenCalled();
});
