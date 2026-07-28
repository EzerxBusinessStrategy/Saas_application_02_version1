import { describe, expect, it } from "vitest";

import { ExamplePolicy } from "./example.policy";
import { ExampleService } from "./example.service";

describe("ExampleService", () => {
  it("creates through the owning repository", async () => {
    const repository = { insert: async (dto: { name: string }) => ({ id: "1", name: dto.name }) };
    const service = new ExampleService(repository, new ExamplePolicy());

    await expect(service.create({ name: "Example" })).resolves.toEqual({
      id: "1",
      name: "Example",
    });
  });
});
