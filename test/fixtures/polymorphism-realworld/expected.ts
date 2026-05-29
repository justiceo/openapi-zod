import * as z from "zod";

export const openApiMetadata = {
  info: {
    title: "Polymorphic Events API",
    version: "1.0.0",
  },
  openapi: "3.1.0",
} as const;

const __openapiZodOneOf = (value: unknown, ctx: z.core.$RefinementCtx, schemas: z.ZodType[]): void => {
  let matches = 0;
  for (const schema of schemas) {
    if (schema.safeParse(value).success) matches += 1;
  }
  if (matches !== 1) ctx.addIssue({ code: "custom", message: "Expected exactly one schema to match." });
};

export const EventSchema = z.unknown().superRefine((value, ctx) => __openapiZodOneOf(value, ctx, [z.lazy(() => UserCreatedEventSchema), z.lazy(() => UserDeletedEventSchema)])).pipe(z.union([z.lazy(() => UserCreatedEventSchema), z.lazy(() => UserDeletedEventSchema)]));
export type Event = z.infer<typeof EventSchema>;

export const SearchResultSchema = z.union([z.lazy(() => UserCreatedEventSchema), z.object({
  cursor: z.string(),
})]);
export type SearchResult = z.infer<typeof SearchResultSchema>;

export const UserSchema = z.object({
  email: z.email().optional(),
  id: z.string(),
});
export type User = z.infer<typeof UserSchema>;

export const UserCreatedEventSchema = z.object({
  type: z.literal("user.created"),
  user: UserSchema,
});
export type UserCreatedEvent = z.infer<typeof UserCreatedEventSchema>;

export const UserDeletedEventSchema = z.object({
  id: z.string(),
  type: z.literal("user.deleted"),
});
export type UserDeletedEvent = z.infer<typeof UserDeletedEventSchema>;

export const ingestEventOperation = {
  operationId: "ingestEvent",
  method: "post",
  path: "/events",
  request: {
    body: EventSchema.optional(),
  },
  responses: {
    "202": {
      description: "Accepted",
    },
  },
} as const;
export type IngestEventRequest = typeof ingestEventOperation.request;
export type IngestEventResponses = typeof ingestEventOperation.responses;

export const routes = [ingestEventOperation] as const;
type GeneratedRouteOperation = { method: string; path: string; request?: unknown };
export type RouteOperation = typeof routes[number] extends never ? GeneratedRouteOperation : typeof routes[number];
export type RouteMatchSuccess = { success: true; operation: RouteOperation; params: unknown; query: unknown; headers: unknown; cookies: unknown; body: unknown };
export type RouteMatchError =
  | { code: "notFound"; message: string }
  | { code: "validation"; message: string; operation: RouteOperation; location: "params" | "query" | "headers" | "cookies" | "body"; issues: z.core.$ZodIssue[] }
  | { code: "body"; message: string; operation: RouteOperation; cause: unknown };
export type RouteMatchFailure = { success: false; error: RouteMatchError };
export type RouteMatchResult = RouteMatchSuccess | RouteMatchFailure;
export type RouteRequest = {
  method: string;
  url?: string;
  path?: string;
  originalUrl?: string;
  headers?: unknown;
  query?: unknown;
  cookies?: unknown;
  body?: unknown;
  bodyUsed?: boolean;
  json?: () => Promise<unknown>;
};
type RouteMatcherNode = { operation?: RouteOperation; literals: Record<string, RouteMatcherNode>; param?: { name: string; node: RouteMatcherNode } };
type RouteMatcher = { exact: Record<string, RouteOperation>; dynamic: Record<string, Record<number, RouteMatcherNode>> };
type RouteCandidate = { operation: RouteOperation; params: Record<string, unknown>; decodeFailed: boolean };

const routeMatcher = buildRouteMatcher(routes);

export async function getRoute(request: RouteRequest, options: { readBody?: boolean } = {}): Promise<RouteMatchResult> {
  const method = request.method.toLowerCase();
  const pathname = routeRequestPathname(request);
  const candidate = matchRoute(method, pathname);
  if (!candidate) return { success: false, error: { code: "notFound", message: `No route matched ${method.toUpperCase()} ${pathname}.` } };
  const operation = candidate.operation;
  if (candidate.decodeFailed) {
    return {
      success: false,
      error: { code: "validation", message: "Path parameters could not be decoded.", operation, location: "params", issues: [] },
    };
  }
  const query = routeQueryValues(request);
  const headers = routeHeaderValues(request.headers);
  const cookies = routeCookieValues(request, headers);
  const requestSchemas = operation.request as Partial<Record<"params" | "query" | "headers" | "cookies" | "body", z.ZodType>>;
  const parsedParams = validateRouteInput(operation, "params", requestSchemas.params, candidate.params);
  if (!parsedParams.success) return parsedParams;
  const parsedQuery = validateRouteInput(operation, "query", requestSchemas.query, query);
  if (!parsedQuery.success) return parsedQuery;
  const parsedHeaders = validateRouteInput(operation, "headers", requestSchemas.headers, headers);
  if (!parsedHeaders.success) return parsedHeaders;
  const parsedCookies = validateRouteInput(operation, "cookies", requestSchemas.cookies, cookies);
  if (!parsedCookies.success) return parsedCookies;
  const bodyResult = await routeBodyValue(request, operation, options.readBody !== false);
  if (!bodyResult.success) return bodyResult;
  const parsedBody = validateRouteInput(operation, "body", requestSchemas.body, bodyResult.value);
  if (!parsedBody.success) return parsedBody;
  return {
    success: true,
    operation,
    params: parsedParams.value,
    query: parsedQuery.value,
    headers: parsedHeaders.value,
    cookies: parsedCookies.value,
    body: parsedBody.value,
  };
}

function buildRouteMatcher(items: readonly RouteOperation[]): RouteMatcher {
  const matcher: RouteMatcher = { exact: {}, dynamic: {} };
  for (const operation of items) {
    const segments = routePathSegments(operation.path);
    const hasParams = segments.some((segment) => segment.startsWith("{") && segment.endsWith("}"));
    if (!hasParams) {
      matcher.exact[`${operation.method}:${operation.path}`] = operation;
      continue;
    }
    const methodBuckets = matcher.dynamic[operation.method] ??= {};
    let node = methodBuckets[segments.length] ??= { literals: {} };
    for (const segment of segments) {
      const isParam = segment.startsWith("{") && segment.endsWith("}");
      if (isParam) {
        const name = segment.slice(1, -1);
        node.param ??= { name, node: { literals: {} } };
        node = node.param.node;
      } else {
        node = node.literals[segment] ??= { literals: {} };
      }
    }
    node.operation ??= operation;
  }
  return matcher;
}

function matchRoute(method: string, pathname: string): RouteCandidate | undefined {
  const exact = routeMatcher.exact[`${method}:${pathname}`];
  if (exact) return { operation: exact, params: {}, decodeFailed: false };
  const segments = routePathSegments(pathname);
  const root = routeMatcher.dynamic[method]?.[segments.length];
  if (!root) return undefined;
  const params: Record<string, unknown> = {};
  let decodeFailed = false;
  const operation = matchRouteNode(root, segments, 0, params, () => { decodeFailed = true; });
  return operation ? { operation, params, decodeFailed } : undefined;
}

function matchRouteNode(node: RouteMatcherNode, segments: string[], index: number, params: Record<string, unknown>, onDecodeFailed: () => void): RouteOperation | undefined {
  if (index === segments.length) return node.operation;
  const segment = segments[index]!;
  const literal = node.literals[segment];
  if (literal) {
    const operation = matchRouteNode(literal, segments, index + 1, params, onDecodeFailed);
    if (operation) return operation;
  }
  if (!node.param) return undefined;
  const before = params[node.param.name];
  try {
    params[node.param.name] = decodeURIComponent(segment);
  } catch {
    params[node.param.name] = segment;
    onDecodeFailed();
  }
  const operation = matchRouteNode(node.param.node, segments, index + 1, params, onDecodeFailed);
  if (operation) return operation;
  if (before === undefined) delete params[node.param.name];
  else params[node.param.name] = before;
  return undefined;
}

function routeRequestPathname(request: RouteRequest): string {
  const value = request.path ?? request.originalUrl ?? request.url ?? "/";
  const url = new URL(value, "http://openapi-zod.local");
  return url.pathname || "/";
}

function routePathSegments(pathname: string): string[] {
  return pathname.split("/").filter((segment) => segment.length > 0);
}

function routeQueryValues(request: RouteRequest): Record<string, unknown> {
  if (request.query !== undefined) return coerceRouteRecord(request.query);
  const url = new URL(request.url ?? request.originalUrl ?? request.path ?? "/", "http://openapi-zod.local");
  const values: Record<string, unknown> = {};
  url.searchParams.forEach((value, key) => {
    const coerced = coerceRouteScalar(value);
    if (values[key] === undefined) values[key] = coerced;
    else values[key] = Array.isArray(values[key]) ? [...values[key], coerced] : [values[key], coerced];
  });
  return values;
}

function routeHeaderValues(headers: unknown): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  if (!headers) return values;
  const maybeHeaders = headers as { forEach?: (callback: (value: string, key: string) => void) => void; entries?: () => Iterable<[string, unknown]> };
  if (typeof maybeHeaders.forEach === "function") {
    maybeHeaders.forEach((value, key) => { values[key.toLowerCase()] = coerceRouteScalar(value); });
    return values;
  }
  const entries = typeof maybeHeaders.entries === "function" ? Array.from(maybeHeaders.entries()) : Object.entries(headers as Record<string, unknown>);
  for (const [key, value] of entries) values[key.toLowerCase()] = coerceRouteValue(value);
  return values;
}

function routeCookieValues(request: RouteRequest, headers: Record<string, unknown>): Record<string, unknown> {
  if (request.cookies !== undefined) return coerceRouteRecord(request.cookies);
  const cookieHeader = headers.cookie;
  if (typeof cookieHeader !== "string") return {};
  const cookies: Record<string, unknown> = {};
  for (const part of cookieHeader.split(";")) {
    const index = part.indexOf("=");
    if (index < 0) continue;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (key) cookies[key] = coerceRouteScalar(value);
  }
  return cookies;
}

async function routeBodyValue(request: RouteRequest, operation: RouteOperation, readBody: boolean): Promise<{ success: true; value: unknown } | RouteMatchFailure> {
  if (!readBody) return { success: true, value: undefined };
  if (typeof request.json === "function" && request.bodyUsed !== true) {
    try {
      return { success: true, value: await request.json() };
    } catch (cause) {
      return { success: false, error: { code: "body", message: "Request body could not be parsed.", operation, cause } };
    }
  }
  return { success: true, value: request.body };
}

function validateRouteInput(operation: RouteOperation, location: "params" | "query" | "headers" | "cookies" | "body", schema: z.ZodType | undefined, value: unknown): { success: true; value: unknown } | RouteMatchFailure {
  if (!schema) return { success: true, value };
  const result = schema.safeParse(value);
  if (result.success) return { success: true, value: result.data };
  return { success: false, error: { code: "validation", message: `${location} validation failed.`, operation, location, issues: result.error.issues } };
}

function coerceRouteRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
  const result: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) result[key] = coerceRouteValue(item);
  return result;
}

function coerceRouteValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => coerceRouteValue(item));
  return coerceRouteScalar(value);
}

function coerceRouteScalar(value: unknown): unknown {
  if (typeof value !== "string") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  if (/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value)) return Number(value);
  return value;
}
