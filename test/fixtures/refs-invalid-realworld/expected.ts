import * as z from "zod";

export const openApiMetadata = {
  info: {
    title: "Broken References API",
    version: "1.0.0",
  },
  openapi: "3.1.0",
} as const;

export const BrokenLocalSchema = z.object({
  missing: z.unknown().optional(),
});
export type BrokenLocal = z.infer<typeof BrokenLocalSchema>;

export const ExternalLocalSchema = z.unknown();
export type ExternalLocal = z.infer<typeof ExternalLocalSchema>;

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

export const routes = [getBrokenOperation] as const;
