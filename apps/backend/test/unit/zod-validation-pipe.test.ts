import { BadRequestException } from "@nestjs/common";
import { describe, expect, test } from "vitest";
import { z } from "zod";
import { ZodValidationPipe } from "../../src/common/validation/zod-validation.pipe";

describe("ZodValidationPipe", () => {
  const pipe = new ZodValidationPipe(
    z.object({
      email: z.string().email(),
    }),
  );

  test("returns parsed values", () => {
    expect(pipe.transform({ email: "admin@example.com" })).toEqual({
      email: "admin@example.com",
    });
  });

  test("throws a safe validation envelope payload", () => {
    try {
      pipe.transform({ email: "not-an-email" });
    } catch (error) {
      if (!(error instanceof BadRequestException)) throw error;
      expect(error.getResponse()).toMatchObject({
        code: "VALIDATION_ERROR",
        message: "Request validation failed.",
        details: [{ path: "email" }],
      });
    }
  });
});
