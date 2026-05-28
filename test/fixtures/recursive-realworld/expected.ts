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

export const getCategoryOperation = {
  operationId: "getCategory",
  method: "get",
  path: "/categories/{id}",
  tags: [],
  deprecated: false,
  security: [],
  request: {
    params: z.object({
      id: z.string(),
    }),
    query: z.object({}),
    headers: z.object({}),
    cookies: z.object({}),
    body: undefined,
  },
  responses: {
    "200": {
      description: "Category",
      headers: z.object({}),
      content: {
        "application/json": CategorySchema,
      },
    },
  },
} as const;
export type GetCategoryRequest = typeof getCategoryOperation.request;
export type GetCategoryResponses = typeof getCategoryOperation.responses;

export const routes = [getCategoryOperation] as const;
