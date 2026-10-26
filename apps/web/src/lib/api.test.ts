import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { ApiError, createApiClient } from "./api";

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
    ...init,
  });
}

function clientWith(
  fetchMock: ReturnType<typeof vi.fn>,
  extra: { onUnauthorized?: () => void } = {},
) {
  return createApiClient({
    baseUrl: "https://api.club.test",
    getToken: async () => "token-123",
    fetch: fetchMock as unknown as typeof fetch,
    ...extra,
  });
}

const tariff = z.object({ id: z.string(), name: z.string() });

describe("createApiClient", () => {
  it("sends the bearer token and parses the response with the schema", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ id: "t1", name: "Monthly", extra: true }));

    const result = await clientWith(fetchMock).get(tariff, "/api/tariffs/t1");

    expect(result).toEqual({ id: "t1", name: "Monthly" });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.club.test/api/tariffs/t1");
    expect(init.method).toBe("GET");
    expect(init.headers).toMatchObject({
      authorization: "Bearer token-123",
      accept: "application/json",
    });
  });

  it("builds a query string and leaves out empty values", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ id: "t1", name: "x" }));

    await clientWith(fetchMock).get(tariff, "/api/members", {
      q: "olena",
      limit: 25,
      active: false,
      coachId: undefined,
      note: null,
      blank: "",
    });

    const [url] = fetchMock.mock.calls[0] as unknown as [string];
    expect(url).toBe("https://api.club.test/api/members?q=olena&limit=25&active=false");
  });

  it("sends a json body with the right method and content type", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ id: "t1", name: "New" }, { status: 201 }));

    await clientWith(fetchMock).post(tariff, "/api/tariffs", { name: "New" });
    await clientWith(fetchMock).patch(tariff, "/api/tariffs/t1", { version: 1 });
    await clientWith(fetchMock).put(tariff, "/api/members/m1/coach", { coachId: null });

    const calls = fetchMock.mock.calls as unknown as [string, RequestInit][];
    expect(calls.map(([, init]) => init.method)).toEqual(["POST", "PATCH", "PUT"]);
    expect(calls[0]?.[1].body).toBe('{"name":"New"}');
    expect(calls[0]?.[1].headers).toMatchObject({ "content-type": "application/json" });
  });

  it("turns a problem+json answer into an ApiError with field details", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse(
        {
          title: "Bad Request",
          detail: "Request validation failed",
          errors: [{ path: "email", message: "Invalid email" }],
        },
        { status: 400 },
      ),
    );

    const failure = await clientWith(fetchMock)
      .post(tariff, "/api/members", {})
      .catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(ApiError);
    expect(failure).toMatchObject({
      status: 400,
      message: "Request validation failed",
      fieldErrors: [{ path: "email", message: "Invalid email" }],
    });
  });

  it("falls back to a generic message when the error body is not json", async () => {
    const fetchMock = vi.fn(async () => new Response("<html>oops</html>", { status: 502 }));

    const failure = await clientWith(fetchMock)
      .get(tariff, "/api/tariffs")
      .catch((error: unknown) => error);

    expect(failure).toMatchObject({ status: 502, message: "The server answered with 502" });
  });

  it("reports an unreachable server with status 0", async () => {
    const fetchMock = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    });

    const failure = await clientWith(fetchMock)
      .get(tariff, "/api/tariffs")
      .catch((error: unknown) => error);

    expect(failure).toMatchObject({ status: 0 });
    expect((failure as ApiError).message).toMatch(/cannot be reached/);
  });

  it("calls onUnauthorized for a 401 and still throws", async () => {
    const onUnauthorized = vi.fn();
    const fetchMock = vi.fn(async () =>
      jsonResponse({ detail: "The token has expired" }, { status: 401 }),
    );

    await expect(
      clientWith(fetchMock, { onUnauthorized }).get(tariff, "/api/tariffs"),
    ).rejects.toMatchObject({
      status: 401,
      message: "The token has expired",
    });
    expect(onUnauthorized).toHaveBeenCalledOnce();
  });

  it("rejects a response that does not match the schema", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ unexpected: true }));

    await expect(clientWith(fetchMock).get(tariff, "/api/tariffs/t1")).rejects.toMatchObject({
      message: expect.stringMatching(/does not understand/),
    });
  });

  it("accepts an empty 204 answer when the schema allows it", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 }));

    await expect(
      clientWith(fetchMock).get(z.undefined(), "/api/anything"),
    ).resolves.toBeUndefined();
  });
});
