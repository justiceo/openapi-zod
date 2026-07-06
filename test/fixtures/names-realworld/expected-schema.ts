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
