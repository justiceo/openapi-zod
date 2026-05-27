import * as z from "zod";

export const openApiMetadata = {
  info: {
    title: "Defaults",
    version: "1.0.0",
  },
  openapi: "3.1.0",
} as const;

const __openapiZodStableJson = (value: unknown): string => {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => __openapiZodStableJson(item)).join(",")}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${__openapiZodStableJson(object[key])}`).join(",")}}`;
};

export const ConstValueSchema = z.literal("ready");
export type ConstValue = z.infer<typeof ConstValueSchema>;

export const EnumBadDefaultSchema = z.enum(["small", "medium", "large"]);
export type EnumBadDefault = z.infer<typeof EnumBadDefaultSchema>;

export const EnumDefaultSchema = z.enum(["small", "medium", "large"]).default("medium");
export type EnumDefault = z.infer<typeof EnumDefaultSchema>;

export const IntegerBadDefaultSchema = z.int();
export type IntegerBadDefault = z.infer<typeof IntegerBadDefaultSchema>;

export const NullableDefaultSchema = z.string().nullable().default(null);
export type NullableDefault = z.infer<typeof NullableDefaultSchema>;

export const ObjectLiteralEnumSchema = z.custom((value) => __openapiZodStableJson(value) === "{\"kind\":\"fixed\"}");
export type ObjectLiteralEnum = z.infer<typeof ObjectLiteralEnumSchema>;

export const StringWithDefaultSchema = z.string().default("active");
export type StringWithDefault = z.infer<typeof StringWithDefaultSchema>;

export const routes = [] as const;
