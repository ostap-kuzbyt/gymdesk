import { describe, expect, it } from "vitest";
import { ApiError } from "./api";
import { shouldRetry } from "./query-client";

describe("shouldRetry", () => {
  it("retries network failures and server errors twice", () => {
    expect(shouldRetry(0, new ApiError(0, "offline"))).toBe(true);
    expect(shouldRetry(1, new ApiError(503, "unavailable"))).toBe(true);
    expect(shouldRetry(2, new ApiError(503, "unavailable"))).toBe(false);
  });

  it("does not retry problems the user has to fix", () => {
    expect(shouldRetry(0, new ApiError(400, "invalid"))).toBe(false);
    expect(shouldRetry(0, new ApiError(401, "expired"))).toBe(false);
    expect(shouldRetry(0, new ApiError(404, "missing"))).toBe(false);
    expect(shouldRetry(0, new ApiError(409, "conflict"))).toBe(false);
  });

  it("does not retry unexpected errors", () => {
    expect(shouldRetry(0, new Error("bug"))).toBe(false);
  });
});
