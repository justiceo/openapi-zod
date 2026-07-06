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
