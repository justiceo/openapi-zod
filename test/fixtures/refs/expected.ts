import * as z from "zod";

export const openApiMetadata = {
  info: {
    title: "Refs",
    version: "1.0.0",
  },
  openapi: "3.0.3",
} as const;

export const NodeSchema: z.ZodTypeAny = z.object({
  child: z.lazy(() => NodeSchema).optional(),
  value: z.string(),
});
export type Node = z.infer<typeof NodeSchema>;

export const PetSchema = z.object({
  external: z.unknown().optional(),
  invalid: z.unknown().optional(),
  owner: z.lazy(() => UserSchema),
});
export type Pet = z.infer<typeof PetSchema>;

export const UserSchema = z.object({
  id: z.string(),
});
export type User = z.infer<typeof UserSchema>;

export const routes = [] as const;
