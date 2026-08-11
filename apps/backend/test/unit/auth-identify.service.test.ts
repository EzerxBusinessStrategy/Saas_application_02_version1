import { describe, expect, it } from "vitest";
import { AuthIdentifyService } from "../../src/auth/auth-identify.service";

describe("AuthIdentifyService", () => {
  it("returns an indistinguishable password method for known and unknown emails", async () => {
    const service = new AuthIdentifyService();

    await expect(service.identifyEmail("known@example.com")).resolves.toEqual({
      method: "password",
    });
    await expect(service.identifyEmail("unknown@example.com")).resolves.toEqual({
      method: "password",
    });
  });
});
