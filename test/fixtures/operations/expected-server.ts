// AUTO-GENERATED FILE. DO NOT EDIT.

import * as z from "zod";
import { getUserOperation, updateUserOperation } from "./operations";
import { getRoute, type RouteRequest } from "./router";
export type ServerOperationShape = {
  operationId: string;
  method: string;
  path: string;
  request: Record<string, unknown>;
  responses: Record<string, unknown>;
};
export type ServerHeaders = Record<string, string>;
export type ServerResult = { status: number; headers: ServerHeaders; body: unknown };
export type ServerExample = {
  request: Record<string, unknown>;
  responses: Record<string, { body?: unknown; headers?: Record<string, unknown> }>;
};
type ServerRequestPart = "params" | "query" | "headers" | "cookies" | "body";
// Validated, parsed request parts; only the parts the operation declares are present.
export type ServerInput<Req> = { [K in keyof Req as K extends ServerRequestPart ? K : never]: Req[K] extends z.ZodType ? z.output<Req[K]> : unknown };
// What a test may pass to inject(): any subset of the request parts, in their pre-parse (input) shape.
export type ServerInjectInput<Req> = { [K in keyof Req as K extends ServerRequestPart ? K : never]?: Req[K] extends z.ZodType ? (K extends "body" ? z.input<Req[K]> : Partial<z.input<Req[K]>>) : unknown };
export type ServerRequest<Op extends ServerOperationShape> = ServerInput<Op["request"]> & {
  operation: Op;
  method: string;
  path: string;
  url: string;
  // Every request header (lowercased), including ones the operation doesn't declare.
  rawHeaders: Record<string, unknown>;
  // The original request object handed to fetch()/handle().
  raw: unknown;
};
type ServerStatusCode<K> = K extends `${infer N extends number}` ? N : number;
type ServerResponseBody<R> = R extends { content: infer C }
  ? C extends Record<string, unknown>
    ? keyof C extends never
      ? undefined
      : "application/json" extends keyof C
        ? C["application/json"] extends z.ZodType
          ? z.input<C["application/json"]>
          : unknown
        : unknown
    : undefined
  : undefined;
type ServerResponseHeaders<R> = (R extends { headers: infer H extends z.ZodType } ? Partial<z.input<H>> : {}) & Record<string, unknown>;
type ServerReplyEntry<R, S> = { status: S; headers?: ServerResponseHeaders<R> } & (undefined extends ServerResponseBody<R> ? { body?: ServerResponseBody<R> } : { body: ServerResponseBody<R> });
// A response the operation declares: { status, body, headers? }, discriminated by status.
export type ServerReply<Responses> = [keyof Responses] extends [never]
  ? { status: number; body?: unknown; headers?: Record<string, unknown> }
  : { [K in keyof Responses]: ServerReplyEntry<Responses[K], ServerStatusCode<K>> }[keyof Responses];
type ServerReplyFor<Reply, S> = Reply extends { status: infer T } ? (S extends T ? Reply : never) : never;
declare const serverReplyBrand: unique symbol;
export type ServerTaggedReply<Responses> = ServerReply<Responses> & { readonly [serverReplyBrand]: true };
// Body of the operation's 2xx responses: what a plain handler returns to answer with the primary success status.
export type ServerSuccessBody<Responses> = [keyof Responses] extends [never]
  ? unknown
  : { [K in keyof Responses as K extends `2${string}` ? K : never]: ServerResponseBody<Responses[K]> } extends infer M
    ? [keyof M] extends [never]
      ? unknown
      : M[keyof M]
    : never;
type ServerReplyFn<Responses> = <S extends ServerReply<Responses>["status"]>(
  status: S,
  ...rest: undefined extends ServerReplyFor<ServerReply<Responses>, S>["body"]
    ? [body?: ServerReplyFor<ServerReply<Responses>, S>["body"], headers?: ServerReplyFor<ServerReply<Responses>, S>["headers"]]
    : [body: ServerReplyFor<ServerReply<Responses>, S>["body"], headers?: ServerReplyFor<ServerReply<Responses>, S>["headers"]]
) => ServerTaggedReply<Responses>;
export type ServerContext<Op extends ServerOperationShape> = ServerRequest<Op> & { reply: ServerReplyFn<Op["responses"]> };
type ServerAwaitable<T> = T | Promise<T>;
// Plain handler: parsed input in, success body (or ctx.reply(...)) out.
export type ServerHandler<Op extends ServerOperationShape> = (input: ServerInput<Op["request"]>, ctx: ServerContext<Op>) => ServerAwaitable<ServerSuccessBody<Op["responses"]> | ServerTaggedReply<Op["responses"]>>;
// Raw handler: the full typed request in, an explicit { status, body, headers } reply out.
export type ServerRawHandler<Op extends ServerOperationShape> = (request: ServerContext<Op>) => ServerAwaitable<ServerReply<Op["responses"]>>;
export type ServerRoute<Op extends ServerOperationShape> = {
  (handler: ServerHandler<Op>): void;
  raw(handler: ServerRawHandler<Op>): void;
};
export type ServerRouteMap<Ops extends Record<string, ServerOperationShape>> = { [K in keyof Ops]: ServerRoute<Ops[K]> };
export type ServerErrorBody = { code: "notFound" | "validation" | "body" | "notImplemented" | "internal" | "response"; message: string; operationId?: string; location?: string; issues?: z.core.$ZodIssue[] };
export type ServerOptions = {
  // Validate every handler reply against the operation's response schema; mismatches become 500s.
  validateResponses?: boolean;
  // Answer unregistered operations with their example response instead of 501.
  mock?: boolean;
  // Turn a thrown handler error into a response. Defaults to a 500 with a generic body.
  onError?: (error: unknown, operation: ServerOperationShape) => ServerAwaitable<ServerResult | undefined>;
};
export type Server<Ops extends Record<string, ServerOperationShape>> = {
  route: ServerRouteMap<Ops>;
  // Fetch-API entry point (Bun.serve, Deno.serve, Workers, Hono, Node 18+ adapters).
  fetch(request: Request): Promise<Response>;
  // Framework-agnostic entry point (Express, Fastify, Koa...): returns status/headers/body to write.
  handle(request: RouteRequest | Request): Promise<ServerResult>;
  // Dispatch an operation's example request (optionally overridden) in-process; for tests.
  inject<K extends keyof Ops>(name: K, overrides?: ServerInjectInput<Ops[K]["request"]>): Promise<ServerResult>;
};
type ServerRegistered = { raw: boolean; handler: (...args: never[]) => unknown };

const serverReplyTag = Symbol.for("sdksmith.server.reply");

export function serverCreate<Ops extends Record<string, ServerOperationShape>>(operations: Ops, examples: Record<string, ServerExample>, options: ServerOptions = {}): Server<Ops> {
  const handlers = new Map<ServerOperationShape, ServerRegistered>();
  const names = new Map<ServerOperationShape, string>();
  const route: Record<string, unknown> = {};
  for (const [name, operation] of Object.entries(operations)) {
    names.set(operation, name);
    const register = (handler: ServerRegistered["handler"]) => { handlers.set(operation, { raw: false, handler }); };
    register.raw = (handler: ServerRegistered["handler"]) => { handlers.set(operation, { raw: true, handler }); };
    route[name] = register;
  }

  async function handle(request: RouteRequest | Request): Promise<ServerResult> {
    let routeRequest: RouteRequest = request;
    if (typeof Request !== "undefined" && request instanceof Request) {
      const body = await serverReadBody(request);
      if (!body.success) return serverError(400, { code: "body", message: "Request body could not be parsed." });
      routeRequest = { method: request.method, url: request.url, headers: request.headers, body: body.value };
    }
    const match = await getRoute(routeRequest);
    if (!match.success) {
      const error = match.error;
      if (error.code === "notFound") return serverError(404, { code: "notFound", message: error.message });
      const operationId = (error.operation as unknown as ServerOperationShape).operationId;
      if (error.code === "validation") return serverError(400, { code: "validation", message: error.message, operationId, location: error.location, issues: error.issues });
      return serverError(400, { code: "body", message: error.message, operationId });
    }
    const operation = match.operation as unknown as ServerOperationShape;
    const registered = handlers.get(operation);
    if (!registered) {
      const example = options.mock ? examples[names.get(operation) ?? ""] : undefined;
      if (example) return serverExampleResult(operation, example);
      return serverError(501, { code: "notImplemented", message: `Operation ${operation.operationId} is not implemented.`, operationId: operation.operationId });
    }
    const input: Record<string, unknown> = {};
    for (const part of ["params", "query", "headers", "cookies", "body"] as const) {
      if (operation.request[part] !== undefined) input[part] = match[part];
    }
    const url = routeRequest.url ?? routeRequest.originalUrl ?? routeRequest.path ?? "/";
    const ctx = {
      ...input,
      operation,
      method: routeRequest.method.toUpperCase(),
      path: new URL(url, "http://sdksmith.local").pathname,
      url,
      rawHeaders: serverHeaderRecord(routeRequest.headers),
      raw: request,
      reply: (status: number, body?: unknown, headers?: Record<string, unknown>) => ({ [serverReplyTag]: true, status, body, headers }),
    };
    let reply: { status: number; body?: unknown; headers?: Record<string, unknown> };
    try {
      if (registered.raw) {
        reply = (await (registered.handler as (ctx: unknown) => unknown)(ctx)) as typeof reply;
      } else {
        const value = await (registered.handler as (input: unknown, ctx: unknown) => unknown)(input, ctx);
        reply = serverIsReply(value) ? value : { status: serverPrimaryStatus(operation), body: value };
      }
    } catch (error) {
      const handled = await options.onError?.(error, operation);
      return handled ?? serverError(500, { code: "internal", message: "Internal server error.", operationId: operation.operationId });
    }
    if (options.validateResponses) {
      const issues = serverValidateReply(operation, reply);
      if (issues) return serverError(500, { code: "response", message: `Response does not match the ${operation.operationId} schema.`, operationId: operation.operationId, issues });
    }
    return { status: reply.status, headers: serverStringHeaders(reply.headers), body: reply.body };
  }

  async function fetchHandler(request: Request): Promise<Response> {
    return serverToResponse(await handle(request));
  }

  async function inject(name: keyof Ops, overrides: Record<string, unknown> = {}): Promise<ServerResult> {
    const operation = operations[name] as ServerOperationShape;
    const example = examples[name as string]?.request ?? {};
    const parts: Record<string, unknown> = {};
    for (const part of ["params", "query", "headers", "cookies"] as const) {
      parts[part] = { ...(example[part] as object | undefined), ...(overrides[part] as object | undefined) };
    }
    const body = "body" in overrides ? overrides.body : example.body;
    const response = await fetchHandler(serverBuildRequest(operation, parts, body));
    const text = await response.text();
    let parsed: unknown = text.length > 0 ? text : undefined;
    if (text.length > 0 && (response.headers.get("content-type") ?? "").includes("json")) {
      try { parsed = JSON.parse(text); } catch { /* keep text */ }
    }
    const headers: ServerHeaders = {};
    response.headers.forEach((value, key) => { headers[key] = value; });
    return { status: response.status, headers, body: parsed };
  }

  return { route: route as ServerRouteMap<Ops>, fetch: fetchHandler, handle, inject: inject as Server<Ops>["inject"] };
}

function serverIsReply(value: unknown): value is { status: number; body?: unknown; headers?: Record<string, unknown> } {
  return typeof value === "object" && value !== null && (value as Record<symbol, unknown>)[serverReplyTag] === true;
}

// First declared 2xx status (exact codes sort ahead of 2XX); falls back to 200.
function serverPrimaryStatus(operation: ServerOperationShape): number {
  const keys = Object.keys(operation.responses);
  const exact = keys.find((key) => /^2\d\d$/.test(key));
  return exact ? Number(exact) : 200;
}

function serverMatchResponse(responses: Record<string, unknown>, status: number): Record<string, unknown> | undefined {
  const value = responses[String(status)] ?? responses[`${Math.floor(status / 100)}XX`] ?? responses.default;
  return value as Record<string, unknown> | undefined;
}

function serverValidateReply(operation: ServerOperationShape, reply: { status: number; body?: unknown; headers?: Record<string, unknown> }): z.core.$ZodIssue[] | undefined {
  const response = serverMatchResponse(operation.responses, reply.status);
  if (!response) {
    if (Object.keys(operation.responses).length === 0) return undefined;
    return [{ code: "custom", message: `Status ${reply.status} is not declared.`, path: ["status"], input: reply.status } as z.core.$ZodIssue];
  }
  const issues: z.core.$ZodIssue[] = [];
  const content = response.content as Record<string, z.ZodType> | undefined;
  const schema = content?.["application/json"];
  if (schema) {
    const result = schema.safeParse(reply.body);
    if (!result.success) issues.push(...result.error.issues.map((issue) => ({ ...issue, path: ["body", ...issue.path] })));
  }
  const headerSchema = response.headers as z.ZodType | undefined;
  if (headerSchema) {
    const lowered = Object.fromEntries(Object.entries(reply.headers ?? {}).map(([key, value]) => [key.toLowerCase(), value]));
    const result = headerSchema.safeParse(lowered);
    if (!result.success) issues.push(...result.error.issues.map((issue) => ({ ...issue, path: ["headers", ...issue.path] })));
  }
  return issues.length > 0 ? issues : undefined;
}

function serverExampleResult(operation: ServerOperationShape, example: ServerExample): ServerResult {
  const keys = Object.keys(operation.responses);
  const key = keys.find((item) => /^2/.test(item)) ?? keys[0];
  const response = key !== undefined ? example.responses[key] : undefined;
  const status = key === undefined ? 200 : /^\d{3}$/.test(key) ? Number(key) : /^\dXX$/.test(key) ? Number(key[0]) * 100 : 200;
  return { status, headers: serverStringHeaders(response?.headers), body: response?.body };
}

function serverError(status: number, body: ServerErrorBody): ServerResult {
  return { status, headers: {}, body };
}

function serverStringHeaders(headers: Record<string, unknown> | undefined): ServerHeaders {
  const result: ServerHeaders = {};
  for (const [key, value] of Object.entries(headers ?? {})) {
    if (value !== undefined && value !== null) result[key.toLowerCase()] = String(value);
  }
  return result;
}

function serverHeaderRecord(headers: unknown): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  if (!headers) return result;
  const maybe = headers as { forEach?: (callback: (value: string, key: string) => void) => void };
  if (typeof maybe.forEach === "function" && !Array.isArray(headers)) {
    maybe.forEach((value, key) => { result[key.toLowerCase()] = value; });
    return result;
  }
  for (const [key, value] of Object.entries(headers as Record<string, unknown>)) result[key.toLowerCase()] = value;
  return result;
}

async function serverReadBody(request: Request): Promise<{ success: true; value: unknown } | { success: false }> {
  if (request.body === null || request.bodyUsed) return { success: true, value: undefined };
  const text = await request.text();
  if (text.length === 0) return { success: true, value: undefined };
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("json")) return { success: true, value: text };
  try {
    return { success: true, value: JSON.parse(text) };
  } catch {
    return { success: false };
  }
}

export function serverToResponse(result: ServerResult): Response {
  const headers = new Headers(result.headers);
  const body = result.body;
  if (body === undefined || body === null || result.status === 204 || result.status === 304) {
    return new Response(null, { status: result.status, headers });
  }
  if (typeof body === "string" || body instanceof ArrayBuffer || ArrayBuffer.isView(body) || (typeof Blob !== "undefined" && body instanceof Blob) || (typeof ReadableStream !== "undefined" && body instanceof ReadableStream)) {
    return new Response(body as BodyInit, { status: result.status, headers });
  }
  if (!headers.has("content-type")) headers.set("content-type", "application/json");
  return new Response(JSON.stringify(body), { status: result.status, headers });
}

function serverBuildRequest(operation: ServerOperationShape, parts: Record<string, unknown>, body: unknown): Request {
  let path = operation.path;
  for (const [key, value] of Object.entries(parts.params as Record<string, unknown>)) {
    if (value !== undefined) path = path.replace(`{${key}}`, encodeURIComponent(String(value)));
  }
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(parts.query as Record<string, unknown>)) {
    if (value === undefined) continue;
    for (const item of Array.isArray(value) ? value : [value]) search.append(key, typeof item === "object" && item !== null ? JSON.stringify(item) : String(item));
  }
  const headers = new Headers();
  for (const [key, value] of Object.entries(parts.headers as Record<string, unknown>)) {
    if (value !== undefined) headers.set(key, String(value));
  }
  const cookies = Object.entries(parts.cookies as Record<string, unknown>).filter(([, value]) => value !== undefined);
  if (cookies.length > 0) headers.set("cookie", cookies.map(([key, value]) => `${key}=${String(value)}`).join("; "));
  const hasBody = body !== undefined;
  if (hasBody && !headers.has("content-type")) headers.set("content-type", "application/json");
  const query = search.toString();
  return new Request(`http://sdksmith.local${path}${query ? `?${query}` : ""}`, {
    method: operation.method.toUpperCase(),
    headers,
    body: hasBody ? (typeof body === "string" ? body : JSON.stringify(body)) : undefined,
  });
}

export const serverOperations = {
  getUser: getUserOperation,
  updateUser: updateUserOperation,
};

// Example requests/responses per operation (explicit OpenAPI examples, otherwise synthesized from the schema).
export const serverExamples = {
  getUser: {
    request: {
      params: {
        userId: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      },
    },
    responses: {
      "200": {
        body: {
          email: "user@example.com",
          id: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        },
      },
      "default": {
        body: {
          message: "string",
        },
      },
    },
  },
  updateUser: {
    request: {
      body: {
        email: "user@example.com",
        id: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      },
      params: {
        userId: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      },
    },
    responses: {
      "204": {},
    },
  },
};

export type ServerRoutes = ServerRouteMap<typeof serverOperations>;

export function createServer(options: ServerOptions = {}): Server<typeof serverOperations> {
  return serverCreate(serverOperations, serverExamples, options);
}
