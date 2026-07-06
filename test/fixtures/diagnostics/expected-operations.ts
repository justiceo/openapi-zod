import * as z from "zod";

export const missingPathParamOperation = {
  operationId: "missingPathParam",
  method: "get",
  path: "/missing/{userId}",
  request: {
    params: z.object({
      unused: z.string(),
    }),
    serialization: [
      {
        "in": "path",
        name: "unused",
        style: "label",
      },
    ],
  },
  responses: {
    "200": {
      description: "linked",
    },
  },
} as const;
export type MissingPathParamRequest = typeof missingPathParamOperation.request;
export type MissingPathParamResponses = typeof missingPathParamOperation.responses;

export const noResponsesOperation = {
  operationId: "noResponses",
  method: "get",
  path: "/no-responses",
  request: {},
  responses: {},
} as const;
export type NoResponsesRequest = typeof noResponsesOperation.request;
export type NoResponsesResponses = typeof noResponsesOperation.responses;

export const uploadOperation = {
  operationId: "upload",
  method: "post",
  path: "/upload",
  security: [
    {
      MissingAuth: [],
    },
    {
      OAuthAuth: ["unknown"],
    },
  ],
  request: {
    query: z.object({
      filter: z.string().optional(),
    }),
    serialization: [
      {
        "in": "query",
        name: "filter",
        style: "deepObject",
      },
    ],
  },
  responses: {},
} as const;
export type UploadRequest = typeof uploadOperation.request;
export type UploadResponses = typeof uploadOperation.responses;
