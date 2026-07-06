// AUTO-GENERATED FILE. DO NOT EDIT.

import * as z from "zod";

export const openApiMetadata = {
  externalDocs: {
    description: "Find out more about Swagger",
    url: "https://swagger.io",
  },
  info: {
    description: "This is a sample Pet Store Server based on the OpenAPI 3.0 specification.  You can find out more about\nSwagger at [https://swagger.io](https://swagger.io). In the third iteration of the pet store, we've switched to the design first approach!\nYou can now help us improve the API whether it's by making changes to the definition itself or to the code.\nThat way, with time, we can improve the API in general, and expose some of the new features in OAS3.\n\nSome useful links:\n- [The Pet Store repository](https://github.com/swagger-api/swagger-petstore)\n- [The source API definition for the Pet Store](https://github.com/swagger-api/swagger-petstore/blob/master/src/main/resources/openapi.yaml)",
    termsOfService: "https://swagger.io/terms/",
    title: "Swagger Petstore - OpenAPI 3.0",
    version: "1.0.27",
  },
  openapi: "3.0.4",
  servers: [
    {
      url: "https://petstore3.swagger.io/api/v3",
    },
  ],
  tags: [
    {
      description: "Everything about your Pets",
      externalDocs: {
        description: "Find out more",
        url: "https://swagger.io",
      },
      name: "pet",
    },
    {
      description: "Access to Petstore orders",
      externalDocs: {
        description: "Find out more about our store",
        url: "https://swagger.io",
      },
      name: "store",
    },
    {
      description: "Operations about user",
      name: "user",
    },
  ],
} as const;

export const ApiResponseSchema = z.object({
  code: z.int().optional(),
  message: z.string().optional(),
  type: z.string().optional(),
});
export type ApiResponse = z.infer<typeof ApiResponseSchema>;

export const CategorySchema = z.object({
  id: z.int().optional(),
  name: z.string().optional(),
});
export type Category = z.infer<typeof CategorySchema>;

export const OrderSchema = z.object({
  complete: z.boolean().optional(),
  id: z.int().optional(),
  petId: z.int().optional(),
  quantity: z.int().optional(),
  shipDate: z.iso.datetime().optional(),
  status: z.enum(["placed", "approved", "delivered"]).optional(),
});
export type Order = z.infer<typeof OrderSchema>;

export const PetSchema = z.object({
  category: CategorySchema.optional(),
  id: z.int().optional(),
  name: z.string(),
  photoUrls: z.array(z.string()),
  status: z.enum(["available", "pending", "sold"]).optional(),
  tags: z.array(z.lazy(() => TagSchema)).optional(),
});
export type Pet = z.infer<typeof PetSchema>;

export const TagSchema = z.object({
  id: z.int().optional(),
  name: z.string().optional(),
});
export type Tag = z.infer<typeof TagSchema>;

export const UserSchema = z.object({
  email: z.string().optional(),
  firstName: z.string().optional(),
  id: z.int().optional(),
  lastName: z.string().optional(),
  password: z.string().optional(),
  phone: z.string().optional(),
  userStatus: z.int().optional(),
  username: z.string().optional(),
});
export type User = z.infer<typeof UserSchema>;

export const PetRequestBody = PetSchema.optional();

export const UserArrayRequestBody = z.array(UserSchema).optional();

export const api_keySecurity = z.object({ headers: z.object({ api_key: z.string() }) });

export const petstore_authSecurity = z.object({ headers: z.object({ authorization: z.string().regex(new RegExp("^Bearer .+$")) }) });
