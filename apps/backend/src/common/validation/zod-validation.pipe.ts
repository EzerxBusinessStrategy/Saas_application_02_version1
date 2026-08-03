import { BadRequestException, PipeTransform } from "@nestjs/common";
import { ZodType } from "zod";

export class ZodValidationPipe<TOutput> implements PipeTransform<unknown, TOutput> {
  constructor(private readonly schema: ZodType<TOutput>) {}

  transform(value: unknown): TOutput {
    const result = this.schema.safeParse(value);
    if (result.success) return result.data;

    throw new BadRequestException({
      code: "VALIDATION_ERROR",
      message: "Request validation failed.",
      details: result.error.issues.map((issue) => ({
        path: issue.path.length ? issue.path.join(".") : "body",
        message: issue.message,
      })),
    });
  }
}
