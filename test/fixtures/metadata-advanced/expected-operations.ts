import * as z from "zod";

export const getMetaOperation = {
  operationId: "getMeta",
  method: "get",
  path: "/meta",
  tags: ["Meta"],
  request: {},
  responses: {
    "200": {
      description: "ok",
      content: {
        "application/json": z.object({
          ok: z.boolean().optional(),
        }),
      },
    },
  },
  summary: "Get metadata",
  description: "Returns metadata",
  externalDocs: {
    url: "https://example.test/operations/get-meta",
  },
} as const;
export type GetMetaRequest = typeof getMetaOperation.request;
export type GetMetaResponses = typeof getMetaOperation.responses;
