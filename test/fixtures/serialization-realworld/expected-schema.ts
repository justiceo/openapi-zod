// AUTO-GENERATED FILE. DO NOT EDIT.

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
