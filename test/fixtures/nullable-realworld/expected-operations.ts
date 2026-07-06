import * as z from "zod";
import { ProfilePatchSchema, ProfileSchema } from "./schema.js";

export const updateProfileOperation = {
  operationId: "updateProfile",
  method: "patch",
  path: "/profiles/{id}",
  request: {
    params: z.object({
      id: z.string(),
    }),
    body: ProfilePatchSchema.optional(),
  },
  responses: {
    "200": {
      description: "Profile",
      content: {
        "application/json": ProfileSchema,
      },
    },
  },
} as const;
export type UpdateProfileRequest = typeof updateProfileOperation.request;
export type UpdateProfileResponses = typeof updateProfileOperation.responses;
