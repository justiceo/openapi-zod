// AUTO-GENERATED FILE. DO NOT EDIT.

import * as z from "zod";
export type ClientHeaders = Record<string, string>;
export type ClientTokenProvider = string | (() => string | Promise<string>);
export type ClientConfig = {
  baseUrl: string;
  fetch?: typeof fetch;
  headers?: ClientHeaders;
  bearerToken?: ClientTokenProvider;
};
export type ClientOptions = {
  headers?: ClientHeaders;
  signal?: AbortSignal;
  bearerToken?: ClientTokenProvider;
};
export type ClientResultSuccess<T> = { success: true; status: number; response: Response; data: T };
export type ClientResultFailure = { success: false; status: number; response: Response; data: unknown; issues?: z.core.$ZodIssue[] };
export type ClientResult<T> = ClientResultSuccess<T> | ClientResultFailure;
export type ClientOperationInput<Req> = { [K in keyof Req]?: Req[K] extends z.ZodType ? z.input<Req[K]> : never };
export type ClientResponseData<Responses> = Responses extends Record<string, unknown>
  ? { [K in keyof Responses]: Responses[K] extends { content: infer Content } ? (Content extends Record<string, unknown> ? (Content["application/json"] extends z.ZodType ? z.infer<Content["application/json"]> : never) : never) : never }[keyof Responses]
  : unknown;
export type ClientOperationShape = {
  method: string;
  path: string;
  security?: readonly unknown[];
  request: Record<string, unknown>;
  responses: Record<string, unknown>;
};
type ClientSerialization = { in: string; name: string; style?: string; explode?: boolean };

export function clientBuildUrl(config: ClientConfig, operation: ClientOperationShape, input: Record<string, unknown>): string {
  let path = operation.path;
  const params = (input.params ?? {}) as Record<string, unknown>;
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    path = path.replace(`{${key}}`, encodeURIComponent(String(value)));
  }
  const base = config.baseUrl.endsWith("/") ? config.baseUrl.slice(0, -1) : config.baseUrl;
  const pathPart = path.startsWith("/") ? path : `/${path}`;
  const searchParams = new URLSearchParams();
  const query = (input.query ?? {}) as Record<string, unknown>;
  const serialization = (operation.request.serialization as ClientSerialization[] | undefined) ?? [];
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined) continue;
    const meta = serialization.find((item) => item.in === "query" && item.name === key);
    clientAppendQueryParam(searchParams, key, value, meta);
  }
  const search = searchParams.toString();
  return `${base}${pathPart}${search ? `?${search}` : ""}`;
}

function clientAppendQueryParam(searchParams: URLSearchParams, key: string, value: unknown, meta: ClientSerialization | undefined): void {
  const explode = meta?.explode ?? true;
  if (Array.isArray(value)) {
    if (explode) {
      for (const item of value) searchParams.append(key, String(item));
    } else {
      searchParams.append(key, value.map((item) => String(item)).join(","));
    }
    return;
  }
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    if (explode) {
      for (const [entryKey, entryValue] of entries) searchParams.append(entryKey, String(entryValue));
    } else {
      searchParams.append(key, entries.flatMap(([entryKey, entryValue]) => [entryKey, String(entryValue)]).join(","));
    }
    return;
  }
  searchParams.append(key, String(value));
}

function clientCookieHeader(input: Record<string, unknown>): string | undefined {
  const cookies = input.cookies as Record<string, unknown> | undefined;
  if (!cookies) return undefined;
  const entries = Object.entries(cookies).filter(([, value]) => value !== undefined);
  if (entries.length === 0) return undefined;
  return entries.map(([key, value]) => `${key}=${encodeURIComponent(String(value))}`).join("; ");
}

async function clientResolveToken(token: ClientTokenProvider | undefined): Promise<string | undefined> {
  if (token === undefined) return undefined;
  return typeof token === "function" ? await token() : token;
}

async function clientBuildHeaders(config: ClientConfig, operation: ClientOperationShape, input: Record<string, unknown>, options: ClientOptions | undefined, hasBody: boolean): Promise<Record<string, string>> {
  const headers: Record<string, string> = {};
  for (const [key, value] of Object.entries(config.headers ?? {})) headers[key.toLowerCase()] = value;
  const inputHeaders = (input.headers ?? {}) as Record<string, unknown>;
  for (const [key, value] of Object.entries(inputHeaders)) {
    if (value !== undefined) headers[key.toLowerCase()] = String(value);
  }
  for (const [key, value] of Object.entries(options?.headers ?? {})) headers[key.toLowerCase()] = value;
  if (hasBody && !("content-type" in headers)) headers["content-type"] = "application/json";
  const security = operation.security ?? [];
  if (security.length > 0) {
    const token = await clientResolveToken(options?.bearerToken ?? config.bearerToken);
    if (token) headers.authorization = `Bearer ${token}`;
  }
  const cookieHeader = clientCookieHeader(input);
  if (cookieHeader) headers.cookie = cookieHeader;
  return headers;
}

export function clientMatchResponse(responses: Record<string, unknown>, status: number): { key: string; schema: Record<string, unknown> } | undefined {
  const exact = String(status);
  if (responses[exact] !== undefined) return { key: exact, schema: responses[exact] as Record<string, unknown> };
  const range = `${Math.floor(status / 100)}XX`;
  if (responses[range] !== undefined) return { key: range, schema: responses[range] as Record<string, unknown> };
  if (responses.default !== undefined) return { key: "default", schema: responses.default as Record<string, unknown> };
  return undefined;
}

export async function clientRequest<Op extends ClientOperationShape, T = ClientResponseData<Op["responses"]>>(
  config: ClientConfig,
  operation: Op,
  input: ClientOperationInput<Op["request"]> = {},
  options?: ClientOptions,
): Promise<ClientResult<T>> {
  const rawInput = input as Record<string, unknown>;
  const url = clientBuildUrl(config, operation, rawInput);
  const hasBody = rawInput.body !== undefined;
  const headers = await clientBuildHeaders(config, operation, rawInput, options, hasBody);
  const fetchImpl = config.fetch ?? fetch;
  const response = await fetchImpl(url, {
    method: operation.method.toUpperCase(),
    headers,
    body: hasBody ? JSON.stringify(rawInput.body) : undefined,
    signal: options?.signal,
  });
  const status = response.status;
  const contentType = response.headers.get("content-type") ?? "";
  let data: unknown;
  try {
    data = contentType.includes("application/json") ? await response.json() : await response.text();
  } catch {
    data = undefined;
  }
  const match = clientMatchResponse(operation.responses, status);
  if (!match) return { success: false, status, response, data };
  const content = match.schema.content as Record<string, z.ZodType> | undefined;
  const schema = content?.["application/json"];
  if (!schema) return response.ok ? { success: true, status, response, data: data as T } : { success: false, status, response, data };
  const parsed = schema.safeParse(data);
  if (parsed.success) return { success: true, status, response, data: parsed.data as T };
  return { success: false, status, response, data, issues: parsed.error.issues };
}

export function createClient(config: ClientConfig) {
  return {
  };
}
