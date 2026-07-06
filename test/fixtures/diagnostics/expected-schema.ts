import * as z from "zod";

export const openApiMetadata = {
  info: {
    title: "Diagnostics",
    version: "1.0.0",
  },
  openapi: "3.1.0",
} as const;

export const EmptyObjectSchema = z.record(z.string(), z.unknown());
export type EmptyObject = z.infer<typeof EmptyObjectSchema>;

export const OAuthAuthSecurity = z.object({ headers: z.object({ authorization: z.string().regex(new RegExp("^Bearer .+$")) }) });
