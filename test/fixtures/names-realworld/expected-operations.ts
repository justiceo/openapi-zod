// AUTO-GENERATED FILE. DO NOT EDIT.

import * as z from "zod";
import { Schema2024reportSchema } from "./schema";

export const Schema2024reportlookupOperation = {
  operationId: "2024-report.lookup",
  method: "get",
  path: "/reports/{report-id}",
  request: {
    params: z.object({
      "report-id": z.string(),
    }),
    query: z.object({
      "include totals": z.boolean().optional(),
    }),
  },
  responses: {
    "200": {
      description: "Report",
      content: {
        "application/json": Schema2024reportSchema,
      },
    },
  },
} as const;
export type Schema2024reportlookupRequest = typeof Schema2024reportlookupOperation.request;
export type Schema2024reportlookupResponses = typeof Schema2024reportlookupOperation.responses;
