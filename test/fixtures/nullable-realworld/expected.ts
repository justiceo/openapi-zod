import * as z from "zod";

export const openApiMetadata = {
  info: {
    title: "Nullable Profile API",
    version: "1.0.0",
  },
  openapi: "3.0.3",
} as const;

export const ProfileSchema = z.object({
  avatarUrl: z.url().nullable().optional(),
  displayName: z.string(),
  id: z.string(),
});
export type Profile = z.infer<typeof ProfileSchema>;

export const ProfilePatchSchema = z.object({
  displayName: z.string().nullable().optional(),
  tags: z.array(z.string()).nullable().optional(),
});
export type ProfilePatch = z.infer<typeof ProfilePatchSchema>;

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

export const routes = [updateProfileOperation] as const;
