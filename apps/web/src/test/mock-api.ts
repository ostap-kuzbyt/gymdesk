import { vi } from "vitest";

export interface MockRequest {
  method: string;
  path: string;
  query: URLSearchParams;
  params: Record<string, string>;
  body: unknown;
}

type Reply = Response | { status?: number; body: unknown };
type Handler = (request: MockRequest) => Reply | Promise<Reply>;

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export function problem(
  status: number,
  detail: string,
  errors?: { path: string; message: string }[],
): Response {
  return new Response(
    JSON.stringify({ title: "Error", status, detail, ...(errors ? { errors } : {}) }),
    {
      status,
      headers: { "content-type": "application/problem+json" },
    },
  );
}

function compile(pattern: string) {
  const names: string[] = [];
  const source = pattern.replace(/:(\w+)/g, (_match, name: string) => {
    names.push(name);
    return "([^/]+)";
  });
  return { regex: new RegExp(`^${source}$`), names };
}

export function mockApi(routes: Record<string, Handler>) {
  const compiled = Object.entries(routes).map(([key, handler]) => {
    const [method = "GET", pattern = ""] = key.split(" ");
    return { method, handler, ...compile(pattern) };
  });

  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), "http://localhost");
    const method = (init?.method ?? "GET").toUpperCase();
    const route = compiled.find(
      (candidate) => candidate.method === method && candidate.regex.test(url.pathname),
    );
    if (!route) return problem(404, `No mock for ${method} ${url.pathname}`);

    const match = route.regex.exec(url.pathname);
    const params = Object.fromEntries(
      route.names.map((name, index) => [name, match?.[index + 1] ?? ""]),
    );
    const body = typeof init?.body === "string" ? (JSON.parse(init.body) as unknown) : undefined;

    const reply = await route.handler({
      method,
      path: url.pathname,
      query: url.searchParams,
      params,
      body,
    });
    if (reply instanceof Response) return reply;
    return json(reply.body, reply.status ?? 200);
  });

  return Object.assign(fetchMock as unknown as typeof fetch, {
    calls: (method: string, pathPrefix = "") =>
      fetchMock.mock.calls
        .map(([input, init]) => ({
          method: (init?.method ?? "GET").toUpperCase(),
          path: new URL(String(input), "http://localhost").pathname,
          body: typeof init?.body === "string" ? (JSON.parse(init.body) as unknown) : undefined,
        }))
        .filter((call) => call.method === method && call.path.startsWith(pathPrefix)),
  });
}
