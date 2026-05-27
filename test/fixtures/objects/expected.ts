import * as z from "zod";

export const openApiMetadata = {
  info: {
    title: "Objects",
    version: "1.0.0",
  },
  openapi: "3.1.0",
} as const;

export const PetSchema = z.object({
  id: z.uuid(),
  metadata: z.record(z.string(), z.string()).optional(),
  name: z.string(),
  tag: z.string().nullable().optional(),
});
export type Pet = z.infer<typeof PetSchema>;

export const ProfileSchema = z.object({
  age: z.int().optional(),
  "display-name": z.string(),
});
export type Profile = z.infer<typeof ProfileSchema>;

export const routes = [] as const;
