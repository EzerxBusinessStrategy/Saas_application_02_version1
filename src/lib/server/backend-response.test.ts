import { describe, expect, test } from "vitest";
import {
  backendStartingMessage,
  isBackendStartingResponse,
  parseBackendJson,
} from "@/lib/server/backend-response";

describe("backend-response", () => {
  test("detects Render cold-start HTML", () => {
    const html = "<html>Service waking up ... Application loading</html>";
    expect(isBackendStartingResponse(200, html)).toBe(true);
    expect(parseBackendJson(200, html)).toEqual({ message: backendStartingMessage });
  });

  test("parses JSON login errors", () => {
    const body = '{"error":{"message":"Invalid email or password."}}';
    expect(parseBackendJson(401, body)).toEqual({
      error: { message: "Invalid email or password." },
    });
  });
});
