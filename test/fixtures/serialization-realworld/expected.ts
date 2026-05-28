import * as z from "zod";

export const openApiMetadata = {
  info: {
    title: "Search API",
    version: "1.0.0",
  },
  openapi: "3.1.0",
} as const;

export const SearchSummarySchema = z.object({
  total: z.int().optional(),
});
export type SearchSummary = z.infer<typeof SearchSummarySchema>;

export const searchOperation = {
  operationId: "search",
  method: "get",
  path: "/search/{ids}",
  tags: [],
  deprecated: false,
  security: [],
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
    cookies: z.object({}),
    body: undefined,
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
      headers: z.object({}),
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

export const routes = [searchOperation] as const;
