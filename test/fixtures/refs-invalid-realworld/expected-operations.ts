// AUTO-GENERATED FILE. DO NOT EDIT.

import * as z from "zod";

export const getBrokenOperation = {
  operationId: "getBroken",
  method: "get",
  path: "/broken",
  request: {
    query: z.object({
      unknown: z.unknown().optional(),
    }),
  },
  responses: {
    "200": {
      description: "Broken",
      content: {
        "application/json": z.unknown(),
      },
    },
  },
} as const;
export type GetBrokenRequest = typeof getBrokenOperation.request;
export type GetBrokenResponses = typeof getBrokenOperation.responses;
