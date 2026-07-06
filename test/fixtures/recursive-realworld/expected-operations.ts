import * as z from "zod";
import { CategorySchema } from "./schema.js";

export const getCategoryOperation = {
  operationId: "getCategory",
  method: "get",
  path: "/categories/{id}",
  request: {
    params: z.object({
      id: z.string(),
    }),
  },
  responses: {
    "200": {
      description: "Category",
      content: {
        "application/json": CategorySchema,
      },
    },
  },
} as const;
export type GetCategoryRequest = typeof getCategoryOperation.request;
export type GetCategoryResponses = typeof getCategoryOperation.responses;
