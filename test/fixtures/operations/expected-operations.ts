// AUTO-GENERATED FILE. DO NOT EDIT.

import * as z from "zod";
import { ErrorSchema, UserSchema } from "./schema";

export const getUserOperation = {
  operationId: "getUser",
  method: "get",
  path: "/users/{userId}",
  tags: ["Users"],
  security: [
    {
      BearerAuth: [],
    },
  ],
  request: {
    params: z.object({
      userId: z.uuid(),
    }),
    query: z.object({
      includePosts: z.boolean().optional(),
    }),
    headers: z.object({
      "x-request-id": z.string().optional(),
    }),
  },
  responses: {
    "200": {
      description: "User response",
      headers: z.object({
        etag: z.string().optional(),
      }),
      content: {
        "application/json": UserSchema,
      },
    },
    "default": {
      description: "Error response",
      content: {
        "application/json": ErrorSchema,
      },
    },
  },
} as const;
export type GetUserRequest = typeof getUserOperation.request;
export type GetUserResponses = typeof getUserOperation.responses;

export const updateUserOperation = {
  operationId: "updateUser",
  method: "post",
  path: "/users/{userId}",
  tags: ["Users"],
  request: {
    params: z.object({
      userId: z.uuid(),
    }),
    body: UserSchema,
  },
  responses: {
    "204": {
      description: "Updated",
    },
  },
} as const;
export type UpdateUserRequest = typeof updateUserOperation.request;
export type UpdateUserResponses = typeof updateUserOperation.responses;
