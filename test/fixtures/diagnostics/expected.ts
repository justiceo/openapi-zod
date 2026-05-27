import * as z from "zod";

export const openApiMetadata = {
  info: {
    title: "Diagnostics",
    version: "1.0.0",
  },
  openapi: "3.1.0",
} as const;

export const EmptyObjectSchema = z.record(z.string(), z.unknown());
export type EmptyObject = z.infer<typeof EmptyObjectSchema>;

export const OAuthAuthSecurity = z.object({ headers: z.object({ authorization: z.string().regex(new RegExp("^Bearer .+$")) }) });

export const missingPathParamOperation = {
  operationId: "missingPathParam",
  method: "get",
  path: "/missing/{userId}",
  tags: [],
  deprecated: false,
  security: [],
  request: {
    params: z.object({
      unused: z.string(),
    }),
    query: z.object({}),
    headers: z.object({}),
    cookies: z.object({}),
    body: undefined,
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
      headers: z.object({}),
      content: {},
    },
  },
} as const;
export type MissingPathParamRequest = typeof missingPathParamOperation.request;
export type MissingPathParamResponses = typeof missingPathParamOperation.responses;

export const noResponsesOperation = {
  operationId: "noResponses",
  method: "get",
  path: "/no-responses",
  tags: [],
  deprecated: false,
  security: [],
  request: {
    params: z.object({}),
    query: z.object({}),
    headers: z.object({}),
    cookies: z.object({}),
    body: undefined,
  },
  responses: {},
} as const;
export type NoResponsesRequest = typeof noResponsesOperation.request;
export type NoResponsesResponses = typeof noResponsesOperation.responses;

export const uploadOperation = {
  operationId: "upload",
  method: "post",
  path: "/upload",
  tags: [],
  deprecated: false,
  security: [
    {
      MissingAuth: [],
    },
    {
      OAuthAuth: ["unknown"],
    },
  ],
  request: {
    params: z.object({}),
    query: z.object({
      filter: z.string().optional(),
    }),
    headers: z.object({}),
    cookies: z.object({}),
    body: undefined,
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

export const routes = [missingPathParamOperation, noResponsesOperation, uploadOperation] as const;
