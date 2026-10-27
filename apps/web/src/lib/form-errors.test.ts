import { describe, expect, it, vi } from "vitest";
import { ApiError } from "./api";
import { applyApiError } from "./form-errors";

interface Values {
  name: string;
  price: string;
}

describe("applyApiError", () => {
  it("puts known field errors on their form fields", () => {
    const setError = vi.fn();
    const onForm = vi.fn();
    const error = new ApiError(400, "Request validation failed", [
      { path: "priceCents", message: "Too high" },
      { path: "unknown", message: "Ignored" },
    ]);

    applyApiError<Values>(error, { setError, fields: { priceCents: "price" }, onForm });

    expect(setError).toHaveBeenCalledOnce();
    expect(setError).toHaveBeenCalledWith("price", { message: "Too high" });
    expect(onForm).not.toHaveBeenCalled();
  });

  it("falls back to a form-level message when no field matches", () => {
    const setError = vi.fn();
    const onForm = vi.fn();

    applyApiError<Values>(new ApiError(409, "Changed by someone else"), {
      setError,
      fields: { name: "name" },
      onForm,
    });

    expect(setError).not.toHaveBeenCalled();
    expect(onForm).toHaveBeenCalledWith("Changed by someone else");
  });

  it("hides the details of unexpected errors", () => {
    const onForm = vi.fn();

    applyApiError<Values>(new Error("stack trace"), { setError: vi.fn(), fields: {}, onForm });

    expect(onForm).toHaveBeenCalledWith("Something went wrong. Try again.");
  });
});
