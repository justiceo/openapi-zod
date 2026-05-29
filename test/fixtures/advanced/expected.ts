import * as z from "zod";

export const openApiMetadata = {
  info: {
    title: "Advanced",
    version: "1.0.0",
  },
  openapi: "3.1.0",
} as const;

const __openapiZodStableJson = (value: unknown): string => {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => __openapiZodStableJson(item)).join(",")}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${__openapiZodStableJson(object[key])}`).join(",")}}`;
};

const __openapiZodOneOf = (value: unknown, ctx: z.core.$RefinementCtx, schemas: z.ZodType[]): void => {
  let matches = 0;
  for (const schema of schemas) {
    if (schema.safeParse(value).success) matches += 1;
  }
  if (matches !== 1) ctx.addIssue({ code: "custom", message: "Expected exactly one schema to match." });
};

const __openapiZodUniqueItems = (items: unknown[], ctx: z.core.$RefinementCtx): void => {
  const seen = new Set<string>();
  for (const item of items) {
    const key = __openapiZodStableJson(item);
    if (seen.has(key)) {
      ctx.addIssue({ code: "custom", message: "Expected array items to be unique." });
      return;
    }
    seen.add(key);
  }
};

const __openapiZodPropertyNames = (value: Record<string, unknown>, ctx: z.core.$RefinementCtx, schema: z.ZodType): void => {
  for (const key of Object.keys(value)) {
    if (!schema.safeParse(key).success) ctx.addIssue({ code: "custom", path: [key], message: "Object property name did not match the required schema." });
  }
};

const __openapiZodPatternProperties = (value: Record<string, unknown>, ctx: z.core.$RefinementCtx, patterns: Array<[RegExp, z.ZodType]>): void => {
  for (const [key, child] of Object.entries(value)) {
    for (const [pattern, schema] of patterns) {
      if (pattern.test(key) && !schema.safeParse(child).success) ctx.addIssue({ code: "custom", path: [key], message: "Object property did not match its patternProperties schema." });
    }
  }
};

const __openapiZodContains = (items: unknown[], ctx: z.core.$RefinementCtx, schema: z.ZodType, min: number, max: number | undefined): void => {
  let matches = 0;
  for (const item of items) {
    if (schema.safeParse(item).success) matches += 1;
  }
  if (matches < min) ctx.addIssue({ code: "custom", message: `Expected at least ${min} matching array item(s).` });
  if (max !== undefined && matches > max) ctx.addIssue({ code: "custom", message: `Expected at most ${max} matching array item(s).` });
};

const __openapiZodConditional = (value: unknown, ctx: z.core.$RefinementCtx, ifSchema: z.ZodType, thenSchema: z.ZodType | undefined, elseSchema: z.ZodType | undefined): void => {
  const matched = ifSchema.safeParse(value).success;
  if (matched && thenSchema && !thenSchema.safeParse(value).success) ctx.addIssue({ code: "custom", message: "Value did not match the conditional then schema." });
  if (!matched && elseSchema && !elseSchema.safeParse(value).success) ctx.addIssue({ code: "custom", message: "Value did not match the conditional else schema." });
};

const __openapiZodDependentRequired = (value: Record<string, unknown>, ctx: z.core.$RefinementCtx, dependencies: Record<string, string[]>): void => {
  for (const [key, required] of Object.entries(dependencies)) {
    if (!(key in value)) continue;
    for (const requiredKey of required) {
      if (!(requiredKey in value)) ctx.addIssue({ code: "custom", path: [requiredKey], message: `Property ${requiredKey} is required when ${key} is present.` });
    }
  }
};

const __openapiZodDependentSchemas = (value: Record<string, unknown>, ctx: z.core.$RefinementCtx, schemas: Array<[string, z.ZodType]>): void => {
  for (const [key, schema] of schemas) {
    if (key in value && !schema.safeParse(value).success) ctx.addIssue({ code: "custom", path: [key], message: `Object did not match dependent schema for ${key}.` });
  }
};

export const ConditionalValueSchema = z.unknown().superRefine((value, ctx) => __openapiZodConditional(value, ctx, z.object({
  mode: z.literal("strict"),
}), z.object({
  strictValue: z.string(),
}), z.object({
  relaxedValue: z.string(),
}))).pipe(z.object({
  mode: z.string().optional(),
}));
export type ConditionalValue = z.infer<typeof ConditionalValueSchema>;

export const ContactChoiceSchema = z.unknown().superRefine((value, ctx) => __openapiZodOneOf(value, ctx, [z.object({
  email: z.email(),
}), z.object({
  phone: z.string(),
})])).pipe(z.union([z.object({
  email: z.email(),
}), z.object({
  phone: z.string(),
})]));
export type ContactChoice = z.infer<typeof ContactChoiceSchema>;

export const ContainsNumberSchema = z.array(z.number()).superRefine((items, ctx) => __openapiZodContains(items, ctx, z.int(), 2, 3));
export type ContainsNumber = z.infer<typeof ContainsNumberSchema>;

export const DependentSchemaSchema = z.object({
  kind: z.string().optional(),
}).superRefine((value, ctx) => __openapiZodDependentSchemas(value, ctx, [["kind", z.object({
  value: z.string(),
})]]));
export type Dependent = z.infer<typeof DependentSchemaSchema>;

export const FlexibleTupleSchema = z.tuple([z.string(), z.int()], z.boolean());
export type FlexibleTuple = z.infer<typeof FlexibleTupleSchema>;

export const PatternedMapSchema = z.record(z.string(), z.unknown()).refine((value) => Object.keys(value).length >= 1, { message: "Expected at least 1 properties." }).refine((value) => Object.keys(value).length <= 3, { message: "Expected at most 3 properties." }).superRefine((value, ctx) => __openapiZodPropertyNames(value, ctx, z.string().regex(new RegExp("^[a-z-]+$")))).superRefine((value, ctx) => __openapiZodPatternProperties(value, ctx, [[new RegExp("^x-"), z.int()]])).superRefine((value, ctx) => __openapiZodDependentRequired(value, ctx, {
  "credit-card": ["billing-address"],
}));
export type PatternedMap = z.infer<typeof PatternedMapSchema>;

export const UniqueDeepSchema = z.array(z.object({
  id: z.string().optional(),
})).superRefine((items, ctx) => __openapiZodUniqueItems(items, ctx));
export type UniqueDeep = z.infer<typeof UniqueDeepSchema>;

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
