// AUTO-GENERATED FILE. DO NOT EDIT.

import * as z from "zod";

export const openApiMetadata = {
  info: {
    title: "Operations",
    version: "1.0.0",
  },
  openapi: "3.1.0",
  servers: [
    {
      url: "https://api.example.test",
    },
  ],
  tags: [
    {
      name: "Users",
    },
  ],
} as const;

export const ErrorSchema = z.object({
  message: z.string(),
});
export type Error = z.infer<typeof ErrorSchema>;

export const UserSchema = z.object({
  email: z.email(),
  id: z.uuid(),
});
export type User = z.infer<typeof UserSchema>;

export const BearerAuthSecurity = z.object({ headers: z.object({ authorization: z.string().regex(new RegExp("^Bearer .+$")) }) });
