import * as z from "zod";

export const openApiMetadata = {
  externalDocs: {
    description: "Find out more about Swagger",
    url: "https://swagger.io",
  },
  info: {
    description: "This is a sample Pet Store Server based on the OpenAPI 3.0 specification.  You can find out more about\nSwagger at [https://swagger.io](https://swagger.io). In the third iteration of the pet store, we've switched to the design first approach!\nYou can now help us improve the API whether it's by making changes to the definition itself or to the code.\nThat way, with time, we can improve the API in general, and expose some of the new features in OAS3.\n\nSome useful links:\n- [The Pet Store repository](https://github.com/swagger-api/swagger-petstore)\n- [The source API definition for the Pet Store](https://github.com/swagger-api/swagger-petstore/blob/master/src/main/resources/openapi.yaml)",
    termsOfService: "https://swagger.io/terms/",
    title: "Swagger Petstore - OpenAPI 3.0",
    version: "1.0.27",
  },
  openapi: "3.0.4",
  servers: [
    {
      url: "https://petstore3.swagger.io/api/v3",
    },
  ],
  tags: [
    {
      description: "Everything about your Pets",
      externalDocs: {
        description: "Find out more",
        url: "https://swagger.io",
      },
      name: "pet",
    },
    {
      description: "Access to Petstore orders",
      externalDocs: {
        description: "Find out more about our store",
        url: "https://swagger.io",
      },
      name: "store",
    },
    {
      description: "Operations about user",
      name: "user",
    },
  ],
} as const;

export const ApiResponseSchema = z.object({
  code: z.int().optional(),
  message: z.string().optional(),
  type: z.string().optional(),
});
export type ApiResponse = z.infer<typeof ApiResponseSchema>;

export const CategorySchema = z.object({
  id: z.int().optional(),
  name: z.string().optional(),
});
export type Category = z.infer<typeof CategorySchema>;

export const OrderSchema = z.object({
  complete: z.boolean().optional(),
  id: z.int().optional(),
  petId: z.int().optional(),
  quantity: z.int().optional(),
  shipDate: z.iso.datetime().optional(),
  status: z.enum(["placed", "approved", "delivered"]).optional(),
});
export type Order = z.infer<typeof OrderSchema>;

export const PetSchema = z.object({
  category: CategorySchema.optional(),
  id: z.int().optional(),
  name: z.string(),
  photoUrls: z.array(z.string()),
  status: z.enum(["available", "pending", "sold"]).optional(),
  tags: z.array(z.lazy(() => TagSchema)).optional(),
});
export type Pet = z.infer<typeof PetSchema>;

export const TagSchema = z.object({
  id: z.int().optional(),
  name: z.string().optional(),
});
export type Tag = z.infer<typeof TagSchema>;

export const UserSchema = z.object({
  email: z.string().optional(),
  firstName: z.string().optional(),
  id: z.int().optional(),
  lastName: z.string().optional(),
  password: z.string().optional(),
  phone: z.string().optional(),
  userStatus: z.int().optional(),
  username: z.string().optional(),
});
export type User = z.infer<typeof UserSchema>;

export const PetRequestBody = PetSchema.optional();

export const UserArrayRequestBody = z.array(UserSchema).optional();

export const api_keySecurity = z.object({ headers: z.object({ api_key: z.string() }) });

export const petstore_authSecurity = z.object({ headers: z.object({ authorization: z.string().regex(new RegExp("^Bearer .+$")) }) });

export const updatePetOperation = {
  operationId: "updatePet",
  method: "put",
  path: "/pet",
  tags: ["pet"],
  security: [
    {
      petstore_auth: ["write:pets", "read:pets"],
    },
  ],
  request: {
    body: PetSchema,
  },
  responses: {
    "200": {
      description: "Successful operation",
      content: {
        "application/json": PetSchema,
      },
    },
    "400": {
      description: "Invalid ID supplied",
    },
    "404": {
      description: "Pet not found",
    },
    "422": {
      description: "Validation exception",
    },
    "default": {
      description: "Unexpected error",
    },
  },
  summary: "Update an existing pet.",
  description: "Update an existing pet by Id.",
} as const;
export type UpdatePetRequest = typeof updatePetOperation.request;
export type UpdatePetResponses = typeof updatePetOperation.responses;

export const addPetOperation = {
  operationId: "addPet",
  method: "post",
  path: "/pet",
  tags: ["pet"],
  security: [
    {
      petstore_auth: ["write:pets", "read:pets"],
    },
  ],
  request: {
    body: PetSchema,
  },
  responses: {
    "200": {
      description: "Successful operation",
      content: {
        "application/json": PetSchema,
      },
    },
    "400": {
      description: "Invalid input",
    },
    "422": {
      description: "Validation exception",
    },
    "default": {
      description: "Unexpected error",
    },
  },
  summary: "Add a new pet to the store.",
  description: "Add a new pet to the store.",
} as const;
export type AddPetRequest = typeof addPetOperation.request;
export type AddPetResponses = typeof addPetOperation.responses;

export const findPetsByStatusOperation = {
  operationId: "findPetsByStatus",
  method: "get",
  path: "/pet/findByStatus",
  tags: ["pet"],
  security: [
    {
      petstore_auth: ["write:pets", "read:pets"],
    },
  ],
  request: {
    query: z.object({
      status: z.enum(["available", "pending", "sold"]).default("available"),
    }),
    serialization: [
      {
        explode: true,
        "in": "query",
        name: "status",
      },
    ],
  },
  responses: {
    "200": {
      description: "successful operation",
      content: {
        "application/json": z.array(PetSchema),
      },
    },
    "400": {
      description: "Invalid status value",
    },
    "default": {
      description: "Unexpected error",
    },
  },
  summary: "Finds Pets by status.",
  description: "Multiple status values can be provided with comma separated strings.",
} as const;
export type FindPetsByStatusRequest = typeof findPetsByStatusOperation.request;
export type FindPetsByStatusResponses = typeof findPetsByStatusOperation.responses;

export const findPetsByTagsOperation = {
  operationId: "findPetsByTags",
  method: "get",
  path: "/pet/findByTags",
  tags: ["pet"],
  security: [
    {
      petstore_auth: ["write:pets", "read:pets"],
    },
  ],
  request: {
    query: z.object({
      tags: z.array(z.string()),
    }),
    serialization: [
      {
        explode: true,
        "in": "query",
        name: "tags",
      },
    ],
  },
  responses: {
    "200": {
      description: "successful operation",
      content: {
        "application/json": z.array(PetSchema),
      },
    },
    "400": {
      description: "Invalid tag value",
    },
    "default": {
      description: "Unexpected error",
    },
  },
  summary: "Finds Pets by tags.",
  description: "Multiple tags can be provided with comma separated strings. Use tag1, tag2, tag3 for testing.",
} as const;
export type FindPetsByTagsRequest = typeof findPetsByTagsOperation.request;
export type FindPetsByTagsResponses = typeof findPetsByTagsOperation.responses;

export const getPetByIdOperation = {
  operationId: "getPetById",
  method: "get",
  path: "/pet/{petId}",
  tags: ["pet"],
  security: [
    {
      api_key: [],
    },
    {
      petstore_auth: ["write:pets", "read:pets"],
    },
  ],
  request: {
    params: z.object({
      petId: z.int(),
    }),
  },
  responses: {
    "200": {
      description: "successful operation",
      content: {
        "application/json": PetSchema,
      },
    },
    "400": {
      description: "Invalid ID supplied",
    },
    "404": {
      description: "Pet not found",
    },
    "default": {
      description: "Unexpected error",
    },
  },
  summary: "Find pet by ID.",
  description: "Returns a single pet.",
} as const;
export type GetPetByIdRequest = typeof getPetByIdOperation.request;
export type GetPetByIdResponses = typeof getPetByIdOperation.responses;

export const updatePetWithFormOperation = {
  operationId: "updatePetWithForm",
  method: "post",
  path: "/pet/{petId}",
  tags: ["pet"],
  security: [
    {
      petstore_auth: ["write:pets", "read:pets"],
    },
  ],
  request: {
    params: z.object({
      petId: z.int(),
    }),
    query: z.object({
      name: z.string().optional(),
      status: z.string().optional(),
    }),
  },
  responses: {
    "200": {
      description: "successful operation",
      content: {
        "application/json": PetSchema,
      },
    },
    "400": {
      description: "Invalid input",
    },
    "default": {
      description: "Unexpected error",
    },
  },
  summary: "Updates a pet in the store with form data.",
  description: "Updates a pet resource based on the form data.",
} as const;
export type UpdatePetWithFormRequest = typeof updatePetWithFormOperation.request;
export type UpdatePetWithFormResponses = typeof updatePetWithFormOperation.responses;

export const deletePetOperation = {
  operationId: "deletePet",
  method: "delete",
  path: "/pet/{petId}",
  tags: ["pet"],
  security: [
    {
      petstore_auth: ["write:pets", "read:pets"],
    },
  ],
  request: {
    params: z.object({
      petId: z.int(),
    }),
    headers: z.object({
      api_key: z.string().optional(),
    }),
  },
  responses: {
    "200": {
      description: "Pet deleted",
    },
    "400": {
      description: "Invalid pet value",
    },
    "default": {
      description: "Unexpected error",
    },
  },
  summary: "Deletes a pet.",
  description: "Delete a pet.",
} as const;
export type DeletePetRequest = typeof deletePetOperation.request;
export type DeletePetResponses = typeof deletePetOperation.responses;

export const uploadFileOperation = {
  operationId: "uploadFile",
  method: "post",
  path: "/pet/{petId}/uploadImage",
  tags: ["pet"],
  security: [
    {
      petstore_auth: ["write:pets", "read:pets"],
    },
  ],
  request: {
    params: z.object({
      petId: z.int(),
    }),
    query: z.object({
      additionalMetadata: z.string().optional(),
    }),
  },
  responses: {
    "200": {
      description: "successful operation",
      content: {
        "application/json": ApiResponseSchema,
      },
    },
    "400": {
      description: "No file uploaded",
    },
    "404": {
      description: "Pet not found",
    },
    "default": {
      description: "Unexpected error",
    },
  },
  summary: "Uploads an image.",
  description: "Upload image of the pet.",
} as const;
export type UploadFileRequest = typeof uploadFileOperation.request;
export type UploadFileResponses = typeof uploadFileOperation.responses;

export const getInventoryOperation = {
  operationId: "getInventory",
  method: "get",
  path: "/store/inventory",
  tags: ["store"],
  security: [
    {
      api_key: [],
    },
  ],
  request: {},
  responses: {
    "200": {
      description: "successful operation",
      content: {
        "application/json": z.record(z.string(), z.int()),
      },
    },
    "default": {
      description: "Unexpected error",
    },
  },
  summary: "Returns pet inventories by status.",
  description: "Returns a map of status codes to quantities.",
} as const;
export type GetInventoryRequest = typeof getInventoryOperation.request;
export type GetInventoryResponses = typeof getInventoryOperation.responses;

export const placeOrderOperation = {
  operationId: "placeOrder",
  method: "post",
  path: "/store/order",
  tags: ["store"],
  request: {
    body: OrderSchema.optional(),
  },
  responses: {
    "200": {
      description: "successful operation",
      content: {
        "application/json": OrderSchema,
      },
    },
    "400": {
      description: "Invalid input",
    },
    "422": {
      description: "Validation exception",
    },
    "default": {
      description: "Unexpected error",
    },
  },
  summary: "Place an order for a pet.",
  description: "Place a new order in the store.",
} as const;
export type PlaceOrderRequest = typeof placeOrderOperation.request;
export type PlaceOrderResponses = typeof placeOrderOperation.responses;

export const getOrderByIdOperation = {
  operationId: "getOrderById",
  method: "get",
  path: "/store/order/{orderId}",
  tags: ["store"],
  request: {
    params: z.object({
      orderId: z.int(),
    }),
  },
  responses: {
    "200": {
      description: "successful operation",
      content: {
        "application/json": OrderSchema,
      },
    },
    "400": {
      description: "Invalid ID supplied",
    },
    "404": {
      description: "Order not found",
    },
    "default": {
      description: "Unexpected error",
    },
  },
  summary: "Find purchase order by ID.",
  description: "For valid response try integer IDs with value <= 5 or > 10. Other values will generate exceptions.",
} as const;
export type GetOrderByIdRequest = typeof getOrderByIdOperation.request;
export type GetOrderByIdResponses = typeof getOrderByIdOperation.responses;

export const deleteOrderOperation = {
  operationId: "deleteOrder",
  method: "delete",
  path: "/store/order/{orderId}",
  tags: ["store"],
  request: {
    params: z.object({
      orderId: z.int(),
    }),
  },
  responses: {
    "200": {
      description: "order deleted",
    },
    "400": {
      description: "Invalid ID supplied",
    },
    "404": {
      description: "Order not found",
    },
    "default": {
      description: "Unexpected error",
    },
  },
  summary: "Delete purchase order by identifier.",
  description: "For valid response try integer IDs with value < 1000. Anything above 1000 or non-integers will generate API errors.",
} as const;
export type DeleteOrderRequest = typeof deleteOrderOperation.request;
export type DeleteOrderResponses = typeof deleteOrderOperation.responses;

export const createUserOperation = {
  operationId: "createUser",
  method: "post",
  path: "/user",
  tags: ["user"],
  request: {
    body: UserSchema.optional(),
  },
  responses: {
    "200": {
      description: "successful operation",
      content: {
        "application/json": UserSchema,
      },
    },
    "default": {
      description: "Unexpected error",
    },
  },
  summary: "Create user.",
  description: "This can only be done by the logged in user.",
} as const;
export type CreateUserRequest = typeof createUserOperation.request;
export type CreateUserResponses = typeof createUserOperation.responses;

export const createUsersWithListInputOperation = {
  operationId: "createUsersWithListInput",
  method: "post",
  path: "/user/createWithList",
  tags: ["user"],
  request: {
    body: z.array(UserSchema).optional(),
  },
  responses: {
    "200": {
      description: "Successful operation",
      content: {
        "application/json": UserSchema,
      },
    },
    "default": {
      description: "Unexpected error",
    },
  },
  summary: "Creates list of users with given input array.",
  description: "Creates list of users with given input array.",
} as const;
export type CreateUsersWithListInputRequest = typeof createUsersWithListInputOperation.request;
export type CreateUsersWithListInputResponses = typeof createUsersWithListInputOperation.responses;

export const loginUserOperation = {
  operationId: "loginUser",
  method: "get",
  path: "/user/login",
  tags: ["user"],
  request: {
    query: z.object({
      password: z.string().optional(),
      username: z.string().optional(),
    }),
  },
  responses: {
    "200": {
      description: "successful operation",
      headers: z.object({
        "x-expires-after": z.iso.datetime().optional(),
        "x-rate-limit": z.int().optional(),
      }),
      content: {
        "application/json": z.string(),
      },
    },
    "400": {
      description: "Invalid username/password supplied",
    },
    "default": {
      description: "Unexpected error",
    },
  },
  summary: "Logs user into the system.",
  description: "Log into the system.",
} as const;
export type LoginUserRequest = typeof loginUserOperation.request;
export type LoginUserResponses = typeof loginUserOperation.responses;

export const logoutUserOperation = {
  operationId: "logoutUser",
  method: "get",
  path: "/user/logout",
  tags: ["user"],
  request: {},
  responses: {
    "200": {
      description: "successful operation",
    },
    "default": {
      description: "Unexpected error",
    },
  },
  summary: "Logs out current logged in user session.",
  description: "Log user out of the system.",
} as const;
export type LogoutUserRequest = typeof logoutUserOperation.request;
export type LogoutUserResponses = typeof logoutUserOperation.responses;

export const getUserByNameOperation = {
  operationId: "getUserByName",
  method: "get",
  path: "/user/{username}",
  tags: ["user"],
  request: {
    params: z.object({
      username: z.string(),
    }),
  },
  responses: {
    "200": {
      description: "successful operation",
      content: {
        "application/json": UserSchema,
      },
    },
    "400": {
      description: "Invalid username supplied",
    },
    "404": {
      description: "User not found",
    },
    "default": {
      description: "Unexpected error",
    },
  },
  summary: "Get user by user name.",
  description: "Get user detail based on username.",
} as const;
export type GetUserByNameRequest = typeof getUserByNameOperation.request;
export type GetUserByNameResponses = typeof getUserByNameOperation.responses;

export const updateUserOperation = {
  operationId: "updateUser",
  method: "put",
  path: "/user/{username}",
  tags: ["user"],
  request: {
    params: z.object({
      username: z.string(),
    }),
    body: UserSchema.optional(),
  },
  responses: {
    "200": {
      description: "successful operation",
    },
    "400": {
      description: "bad request",
    },
    "404": {
      description: "user not found",
    },
    "default": {
      description: "Unexpected error",
    },
  },
  summary: "Update user resource.",
  description: "This can only be done by the logged in user.",
} as const;
export type UpdateUserRequest = typeof updateUserOperation.request;
export type UpdateUserResponses = typeof updateUserOperation.responses;

export const deleteUserOperation = {
  operationId: "deleteUser",
  method: "delete",
  path: "/user/{username}",
  tags: ["user"],
  request: {
    params: z.object({
      username: z.string(),
    }),
  },
  responses: {
    "200": {
      description: "User deleted",
    },
    "400": {
      description: "Invalid username supplied",
    },
    "404": {
      description: "User not found",
    },
    "default": {
      description: "Unexpected error",
    },
  },
  summary: "Delete user resource.",
  description: "This can only be done by the logged in user.",
} as const;
export type DeleteUserRequest = typeof deleteUserOperation.request;
export type DeleteUserResponses = typeof deleteUserOperation.responses;

export const routes = [updatePetOperation, addPetOperation, findPetsByStatusOperation, findPetsByTagsOperation, getPetByIdOperation, updatePetWithFormOperation, deletePetOperation, uploadFileOperation, getInventoryOperation, placeOrderOperation, getOrderByIdOperation, deleteOrderOperation, createUserOperation, createUsersWithListInputOperation, loginUserOperation, logoutUserOperation, getUserByNameOperation, updateUserOperation, deleteUserOperation] as const;
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
