import * as z from "zod";

export const openApiMetadata = {
  info: {
    title: "Naming Edge API",
    version: "1.0.0",
  },
  openapi: "3.1.0",
} as const;

export const Schema2024reportSchema = z.object({
  "class": z.string().optional(),
  "report-id": z.string(),
  "total dollars": z.number().optional(),
});
export type Schema2024report = z.infer<typeof Schema2024reportSchema>;

export const Schema2024reportlookupOperation = {
  operationId: "2024-report.lookup",
  method: "get",
  path: "/reports/{report-id}",
  tags: [],
  deprecated: false,
  security: [],
  request: {
    params: z.object({
      "report-id": z.string(),
    }),
    query: z.object({
      "include totals": z.boolean().optional(),
    }),
    headers: z.object({}),
    cookies: z.object({}),
    body: undefined,
  },
  responses: {
    "200": {
      description: "Report",
      headers: z.object({}),
      content: {
        "application/json": Schema2024reportSchema,
      },
    },
  },
} as const;
export type Schema2024reportlookupRequest = typeof Schema2024reportlookupOperation.request;
export type Schema2024reportlookupResponses = typeof Schema2024reportlookupOperation.responses;

export const routes = [Schema2024reportlookupOperation] as const;
