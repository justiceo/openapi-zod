import * as z from "zod";

export const openApiMetadata = {
  info: {
    title: "Polymorphic Events API",
    version: "1.0.0",
  },
  openapi: "3.1.0",
} as const;

const __openapiZodOneOf = (value: unknown, ctx: z.core.$RefinementCtx, schemas: z.ZodType[]): void => {
  let matches = 0;
  for (const schema of schemas) {
    if (schema.safeParse(value).success) matches += 1;
  }
  if (matches !== 1) ctx.addIssue({ code: "custom", message: "Expected exactly one schema to match." });
};

export const EventSchema = z.unknown().superRefine((value, ctx) => __openapiZodOneOf(value, ctx, [z.lazy(() => UserCreatedEventSchema), z.lazy(() => UserDeletedEventSchema)])).pipe(z.union([z.lazy(() => UserCreatedEventSchema), z.lazy(() => UserDeletedEventSchema)]));
export type Event = z.infer<typeof EventSchema>;

export const SearchResultSchema = z.union([z.lazy(() => UserCreatedEventSchema), z.object({
  cursor: z.string(),
})]);
export type SearchResult = z.infer<typeof SearchResultSchema>;

export const UserSchema = z.object({
  email: z.email().optional(),
  id: z.string(),
});
export type User = z.infer<typeof UserSchema>;

export const UserCreatedEventSchema = z.object({
  type: z.literal("user.created"),
  user: UserSchema,
});
export type UserCreatedEvent = z.infer<typeof UserCreatedEventSchema>;

export const UserDeletedEventSchema = z.object({
  id: z.string(),
  type: z.literal("user.deleted"),
});
export type UserDeletedEvent = z.infer<typeof UserDeletedEventSchema>;

export const ingestEventOperation = {
  operationId: "ingestEvent",
  method: "post",
  path: "/events",
  request: {
    body: EventSchema.optional(),
  },
  responses: {
    "202": {
      description: "Accepted",
    },
  },
} as const;
export type IngestEventRequest = typeof ingestEventOperation.request;
export type IngestEventResponses = typeof ingestEventOperation.responses;

export const routes = [ingestEventOperation] as const;
