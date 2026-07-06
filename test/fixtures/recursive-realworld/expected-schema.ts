// AUTO-GENERATED FILE. DO NOT EDIT.

import * as z from "zod";

export const openApiMetadata = {
  info: {
    title: "Recursive Catalog API",
    version: "1.0.0",
  },
  openapi: "3.1.0",
} as const;

export const CategorySchema: z.ZodTypeAny = z.object({
  children: z.array(z.lazy(() => CategorySchema)).optional(),
  id: z.string(),
  name: z.string(),
  parent: z.union([z.lazy(() => CategorySchema), z.null()]).optional(),
});
export type Category = z.infer<typeof CategorySchema>;

export const CategoryEnvelopeSchema = z.object({
  data: CategorySchema,
});
export type CategoryEnvelope = z.infer<typeof CategoryEnvelopeSchema>;
