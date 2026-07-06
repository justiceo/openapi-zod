import * as z from "zod";

export const openApiMetadata = {
  info: {
    title: "Media API",
    version: "1.0.0",
  },
  openapi: "3.1.0",
} as const;

export const ImportResultSchema = z.object({
  count: z.int(),
});
export type ImportResult = z.infer<typeof ImportResultSchema>;

export const JsonImportSchema = z.object({
  records: z.array(z.record(z.string(), z.unknown())),
});
export type JsonImport = z.infer<typeof JsonImportSchema>;

export const VendorImportSchema = z.object({
  data: z.array(z.record(z.string(), z.unknown())),
});
export type VendorImport = z.infer<typeof VendorImportSchema>;
