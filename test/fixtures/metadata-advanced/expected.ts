import * as z from "zod";

export const openApiMetadata = {
  externalDocs: {
    url: "https://example.test/docs",
  },
  info: {
    description: "Exercises richer metadata",
    summary: "Metadata fixture",
    title: "Metadata Advanced",
    version: "1.0.0",
  },
  openapi: "3.1.0",
  servers: [
    {
      description: "Main server",
      url: "https://{env}.example.test",
      variables: {
        env: {
          "default": "api",
          enum: ["api", "staging"],
        },
      },
    },
  ],
  tags: [
    {
      description: "Metadata tag",
      externalDocs: {
        url: "https://example.test/tags/meta",
      },
      name: "Meta",
    },
  ],
} as const;

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

export const routes = [getMetaOperation] as const;
