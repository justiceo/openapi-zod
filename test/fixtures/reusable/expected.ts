import * as z from "zod";

export const openApiMetadata = {
  info: {
    title: "Reusable",
    version: "1.0.0",
  },
  openapi: "3.1.0",
} as const;

export const ItemSchema = z.object({
  id: z.string(),
  name: z.string(),
});
export type Item = z.infer<typeof ItemSchema>;

export const TraceHeaderHeader = z.string().optional();

export const ItemIdParameter = z.string();

export const TraceIdParameter = z.string().optional();

export const ItemBodyRequestBody = ItemSchema;

export const ItemResponseResponse = {
  description: "Item response",
  headers: z.object({
    "x-trace-id": TraceHeaderHeader,
  }),
  content: {
    "application/json": ItemSchema,
  },
};

export const ApiKeyAuthSecurity = z.object({ headers: z.object({ "x-api-key": z.string() }) });

export const OAuthAuthSecurity = z.object({ headers: z.object({ authorization: z.string().regex(new RegExp("^Bearer .+$")) }) });

export const createItemOperation = {
  operationId: "createItem",
  method: "post",
  path: "/items",
  security: [
    {
      OAuthAuth: ["items:write"],
    },
  ],
  request: {
    body: ItemBodyRequestBody,
  },
  responses: {
    "201": ItemResponseResponse,
  },
} as const;
export type CreateItemRequest = typeof createItemOperation.request;
export type CreateItemResponses = typeof createItemOperation.responses;

export const readItemOperation = {
  operationId: "readItem",
  method: "get",
  path: "/items/{itemId}",
  security: [
    {
      ApiKeyAuth: [],
    },
  ],
  request: {
    params: z.object({
      itemId: ItemIdParameter,
    }),
    headers: z.object({
      "x-trace-id": TraceIdParameter,
    }),
  },
  responses: {
    "200": ItemResponseResponse,
  },
} as const;
export type ReadItemRequest = typeof readItemOperation.request;
export type ReadItemResponses = typeof readItemOperation.responses;

export const routes = [createItemOperation, readItemOperation] as const;
