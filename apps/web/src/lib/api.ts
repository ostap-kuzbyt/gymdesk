import { z } from "zod";

export interface FieldError {
  path: string;
  message: string;
}

export class ApiError extends Error {
  override readonly name = "ApiError";

  constructor(
    readonly status: number,
    message: string,
    readonly fieldErrors: FieldError[] = [],
  ) {
    super(message);
  }
}

type QueryValue = string | number | boolean | null | undefined;

export interface RequestOptions<S extends z.ZodType> {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  query?: Record<string, QueryValue>;
  body?: unknown;
  schema: S;
}

export interface ApiClientOptions {
  baseUrl: string;
  getToken: () => Promise<string>;
  onUnauthorized?: () => void;
  fetch?: typeof fetch;
}

const problemSchema = z.object({
  detail: z.string().optional(),
  title: z.string().optional(),
  errors: z.array(z.object({ path: z.string(), message: z.string() })).optional(),
});

function buildUrl(baseUrl: string, path: string, query: Record<string, QueryValue> = {}): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== "") params.set(key, String(value));
  }
  const search = params.toString();
  return `${baseUrl}${path}${search ? `?${search}` : ""}`;
}

async function readProblem(response: Response): Promise<ApiError> {
  let parsed: z.infer<typeof problemSchema> = {};
  try {
    const result = problemSchema.safeParse(await response.json());
    if (result.success) parsed = result.data;
  } catch {
    parsed = {};
  }
  const message = parsed.detail ?? parsed.title ?? `The server answered with ${response.status}`;
  return new ApiError(response.status, message, parsed.errors ?? []);
}

export function createApiClient(options: ApiClientOptions) {
  const fetchImpl = options.fetch ?? fetch;

  async function request<S extends z.ZodType>(spec: RequestOptions<S>): Promise<z.output<S>> {
    const headers: Record<string, string> = {
      accept: "application/json",
      authorization: `Bearer ${await options.getToken()}`,
    };
    if (spec.body !== undefined) headers["content-type"] = "application/json";

    let response: Response;
    try {
      response = await fetchImpl(buildUrl(options.baseUrl, spec.path, spec.query), {
        method: spec.method ?? "GET",
        headers,
        ...(spec.body === undefined ? {} : { body: JSON.stringify(spec.body) }),
      });
    } catch {
      throw new ApiError(0, "The server cannot be reached. Check your connection and try again.");
    }

    if (response.status === 401) options.onUnauthorized?.();
    if (!response.ok) throw await readProblem(response);

    const payload: unknown = response.status === 204 ? undefined : await response.json();
    const parsed = spec.schema.safeParse(payload);
    if (!parsed.success) {
      throw new ApiError(
        response.status,
        "The server sent a response the app does not understand.",
      );
    }
    return parsed.data;
  }

  return {
    request,
    get: <S extends z.ZodType>(schema: S, path: string, query?: Record<string, QueryValue>) =>
      request({ schema, path, ...(query ? { query } : {}) }),
    post: <S extends z.ZodType>(schema: S, path: string, body?: unknown) =>
      request({ method: "POST", schema, path, body }),
    put: <S extends z.ZodType>(schema: S, path: string, body?: unknown) =>
      request({ method: "PUT", schema, path, body }),
    patch: <S extends z.ZodType>(schema: S, path: string, body?: unknown) =>
      request({ method: "PATCH", schema, path, body }),
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
