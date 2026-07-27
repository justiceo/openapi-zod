// AUTO-GENERATED FILE. DO NOT EDIT.

import * as z from "zod";

export const openApiMetadata = {
  info: {
    title: "Primitives",
    version: "1.0.0",
  },
  openapi: "3.0.3",
} as const;

export const ActiveSchema = z.boolean();
export type Active = z.infer<typeof ActiveSchema>;

export const AgeSchema = z.int().gte(0);
export type Age = z.infer<typeof AgeSchema>;

export const AnythingSchema = z.null();
export type Anything = z.infer<typeof AnythingSchema>;

export const BinarySchema = z.string();
export type Binary = z.infer<typeof BinarySchema>;

export const ByteSchema = z.base64();
export type Byte = z.infer<typeof ByteSchema>;

export const DoubleSchema = z.float64();
export type Double = z.infer<typeof DoubleSchema>;

export const DurationSchema = z.iso.duration();
export type Duration = z.infer<typeof DurationSchema>;

export const EmailSchema = z.email().max(255);
export type Email = z.infer<typeof EmailSchema>;

export const FloatSchema = z.float32();
export type Float = z.infer<typeof FloatSchema>;

export const HostnameSchema = z.hostname();
export type Hostname = z.infer<typeof HostnameSchema>;

export const IdnEmailSchema = z.stringFormat("idn-email", /^[^\s@]+@[^\s@]+\.[^\s@]+$/u);
export type IdnEmail = z.infer<typeof IdnEmailSchema>;

export const IdnHostnameSchema = z.stringFormat("idn-hostname", /^[\p{L}\p{N}](?:[\p{L}\p{N}-]{0,61}[\p{L}\p{N}])?(?:\.[\p{L}\p{N}](?:[\p{L}\p{N}-]{0,61}[\p{L}\p{N}])?)*$/u);
export type IdnHostname = z.infer<typeof IdnHostnameSchema>;

export const Int32Schema = z.int32();
export type Int32 = z.infer<typeof Int32Schema>;

export const Int64Schema = z.int();
export type Int64 = z.infer<typeof Int64Schema>;

export const Ipv4Schema = z.ipv4();
export type Ipv4 = z.infer<typeof Ipv4Schema>;

export const Ipv6Schema = z.ipv6();
export type Ipv6 = z.infer<typeof Ipv6Schema>;

export const IriSchema = z.stringFormat("iri", /^[A-Za-z][A-Za-z0-9+.-]*:\S*$/u);
export type Iri = z.infer<typeof IriSchema>;

export const IriReferenceSchema = z.stringFormat("iri-reference", /^\S*$/u);
export type IriReference = z.infer<typeof IriReferenceSchema>;

export const JsonPointerSchema = z.stringFormat("json-pointer", /^(?:\/(?:[^~/]|~0|~1)*)*$/);
export type JsonPointer = z.infer<typeof JsonPointerSchema>;

export const PasswordSchema = z.string();
export type Password = z.infer<typeof PasswordSchema>;

export const RatingSchema = z.number().gt(0).lte(5);
export type Rating = z.infer<typeof RatingSchema>;

export const RegexSchema = z.string().refine((value) => { try { new RegExp(value); return true; } catch { return false; } }, "Invalid regular expression");
export type Regex = z.infer<typeof RegexSchema>;

export const RelativeJsonPointerSchema = z.stringFormat("relative-json-pointer", /^(?:0|[1-9][0-9]*)(?:#|(?:\/(?:[^~/]|~0|~1)*)*)$/);
export type RelativeJsonPointer = z.infer<typeof RelativeJsonPointerSchema>;

export const SlugSchema = z.string().min(3).regex(new RegExp("^[a-z0-9-]+$"));
export type Slug = z.infer<typeof SlugSchema>;

export const TimeSchema = z.iso.time();
export type Time = z.infer<typeof TimeSchema>;

export const UnknownFormatSchema = z.string();
export type UnknownFormat = z.infer<typeof UnknownFormatSchema>;

export const UriReferenceSchema = z.stringFormat("uri-reference", /^[A-Za-z][A-Za-z0-9+.-]*:\/\/[^\s]*$|^[^\s:]*$|^\/[^\s]*$|^[^\s]*\?[^\s]*$|^[^\s]*#[^\s]*$/);
export type UriReference = z.infer<typeof UriReferenceSchema>;

export const UriTemplateSchema = z.stringFormat("uri-template", /^(?:[^{}]|\{[^{}]*\})*$/);
export type UriTemplate = z.infer<typeof UriTemplateSchema>;

export const routes = [] as const;
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
  const matcher: RouteMatcher = { exact: Object.create(null), dynamic: Object.create(null) };
  for (const operation of items) {
    const segments = routePathSegments(operation.path);
    const hasParams = segments.some((segment) => segment.startsWith("{") && segment.endsWith("}"));
    if (!hasParams) {
      matcher.exact[`${operation.method}:${operation.path}`] = operation;
      continue;
    }
    const methodBuckets = matcher.dynamic[operation.method] ??= Object.create(null);
    let node = methodBuckets[segments.length] ??= { literals: Object.create(null) };
    for (const segment of segments) {
      const isParam = segment.startsWith("{") && segment.endsWith("}");
      if (isParam) {
        const name = segment.slice(1, -1);
        node.param ??= { name, node: { literals: Object.create(null) } };
        node = node.param.node;
      } else {
        node = node.literals[segment] ??= { literals: Object.create(null) };
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
