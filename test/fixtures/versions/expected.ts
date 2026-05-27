import * as z from "zod";

export const openApiMetadata = {
  info: {
    title: "Versions",
    version: "1.0.0",
  },
  openapi: "3.0.3",
} as const;

export const BadExclusiveSchema = z.number().gt(1);
export type BadExclusive = z.infer<typeof BadExclusiveSchema>;

export const IncompatibleTypeArraySchema = z.string().nullable();
export type IncompatibleTypeArray = z.infer<typeof IncompatibleTypeArraySchema>;

export const LegacyExclusiveSchema = z.int().gt(1).lt(10);
export type LegacyExclusive = z.infer<typeof LegacyExclusiveSchema>;

export const LegacyNullableSchema = z.string().nullable();
export type LegacyNullable = z.infer<typeof LegacyNullableSchema>;

export const routes = [] as const;
