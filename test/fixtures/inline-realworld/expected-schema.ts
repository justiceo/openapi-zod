import * as z from "zod";

export const openApiMetadata = {
  info: {
    title: "Inline Checkout API",
    version: "1.0.0",
  },
  openapi: "3.1.0",
} as const;

export const ErrorSchema = z.object({
  message: z.string(),
});
export type Error = z.infer<typeof ErrorSchema>;
