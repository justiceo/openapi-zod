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

export const createOrderOperation = {
  operationId: "createOrder",
  method: "post",
  path: "/orders",
  request: {
    body: z.object({
      customer: z.object({
      email: z.email(),
      metadata: z.record(z.string(), z.string()).optional(),
    }),
      items: z.array(z.object({
      quantity: z.int().gte(1),
      sku: z.string(),
    })).min(1),
    }),
  },
  responses: {
    "201": {
      description: "Created",
      content: {
        "application/json": z.object({
          id: z.string(),
          status: z.enum(["accepted", "queued"]),
        }),
      },
    },
  },
} as const;
export type CreateOrderRequest = typeof createOrderOperation.request;
export type CreateOrderResponses = typeof createOrderOperation.responses;

export const routes = [createOrderOperation] as const;
