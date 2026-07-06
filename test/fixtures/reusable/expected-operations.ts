import * as z from "zod";
import { ItemBodyRequestBody, ItemIdParameter, ItemResponseResponse, TraceIdParameter } from "./schema.js";

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
