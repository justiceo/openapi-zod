import * as z from "zod";

export const searchOperation = {
  operationId: "search",
  method: "get",
  path: "/search/{ids}",
  request: {
    params: z.object({
      ids: z.array(z.string()),
    }),
    query: z.object({
      filter: z.object({
        status: z.string().optional(),
      }).optional(),
    }),
    headers: z.object({
      "x-trace": z.string().optional(),
    }),
    serialization: [
      {
        allowEmptyValue: true,
        "in": "header",
        name: "X-Trace",
      },
      {
        explode: true,
        "in": "path",
        name: "ids",
        style: "label",
      },
      {
        explode: true,
        "in": "query",
        name: "filter",
        style: "deepObject",
      },
    ],
  },
  responses: {
    "200": {
      description: "Results",
      content: {
        "application/json": z.object({
          total: z.int().optional(),
        }),
      },
    },
  },
} as const;
export type SearchRequest = typeof searchOperation.request;
export type SearchResponses = typeof searchOperation.responses;
