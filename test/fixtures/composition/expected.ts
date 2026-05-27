import * as z from "zod";

export const openApiMetadata = {
  info: {
    title: "Composition",
    version: "1.0.0",
  },
  openapi: "3.1.0",
} as const;

export const ColorSchema = z.enum(["red", "green", "blue"]);
export type Color = z.infer<typeof ColorSchema>;

export const DictionarySchema = z.record(z.string(), z.int());
export type Dictionary = z.infer<typeof DictionarySchema>;

export const IdOrNameSchema = z.union([z.string(), z.int()]);
export type IdOrName = z.infer<typeof IdOrNameSchema>;

export const MixedSchema = z.union([z.literal(1), z.literal("two"), z.literal(true)]);
export type Mixed = z.infer<typeof MixedSchema>;

export const RoleSchema = z.literal("admin");
export type Role = z.infer<typeof RoleSchema>;

export const TagsSchema = z.array(z.string()).min(1);
export type Tags = z.infer<typeof TagsSchema>;

export const TimestampedSchema = z.object({
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime().optional(),
});
export type Timestamped = z.infer<typeof TimestampedSchema>;

export const routes = [] as const;
