import { describe, expect, it } from "vitest";
import { ApiError } from "./api";
import { fieldErrorsOf, messageOf } from "./errors";

describe("messageOf", () => {
  it("shows the server's explanation and hides unexpected errors", () => {
    expect(messageOf(new ApiError(409, "The tariff was changed by someone else"))).toBe(
      "The tariff was changed by someone else",
    );
    expect(messageOf(new Error("TypeError: x is undefined"))).toBe(
      "Something went wrong. Try again.",
    );
  });
});

describe("fieldErrorsOf", () => {
  it("maps server field errors by path", () => {
    const error = new ApiError(400, "Request validation failed", [
      { path: "email", message: "Invalid email" },
      { path: "phone", message: "Phone must be in international format" },
    ]);

    expect(fieldErrorsOf(error)).toEqual({
      email: "Invalid email",
      phone: "Phone must be in international format",
    });
  });

  it("is empty for other errors", () => {
    expect(fieldErrorsOf(new Error("boom"))).toEqual({});
    expect(fieldErrorsOf(new ApiError(404, "missing"))).toEqual({});
  });
});
