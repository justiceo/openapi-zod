// AUTO-GENERATED FILE. DO NOT EDIT.

import * as z from "zod";
import { ApiResponseSchema, OrderSchema, PetSchema, UserSchema } from "./schema.js";

export const updatePetOperation = {
  operationId: "updatePet",
  method: "put",
  path: "/pet",
  tags: ["pet"],
  security: [
    {
      petstore_auth: ["write:pets", "read:pets"],
    },
  ],
  request: {
    body: PetSchema,
  },
  responses: {
    "200": {
      description: "Successful operation",
      content: {
        "application/json": PetSchema,
      },
    },
    "400": {
      description: "Invalid ID supplied",
    },
    "404": {
      description: "Pet not found",
    },
    "422": {
      description: "Validation exception",
    },
    "default": {
      description: "Unexpected error",
    },
  },
  summary: "Update an existing pet.",
  description: "Update an existing pet by Id.",
} as const;
export type UpdatePetRequest = typeof updatePetOperation.request;
export type UpdatePetResponses = typeof updatePetOperation.responses;

export const addPetOperation = {
  operationId: "addPet",
  method: "post",
  path: "/pet",
  tags: ["pet"],
  security: [
    {
      petstore_auth: ["write:pets", "read:pets"],
    },
  ],
  request: {
    body: PetSchema,
  },
  responses: {
    "200": {
      description: "Successful operation",
      content: {
        "application/json": PetSchema,
      },
    },
    "400": {
      description: "Invalid input",
    },
    "422": {
      description: "Validation exception",
    },
    "default": {
      description: "Unexpected error",
    },
  },
  summary: "Add a new pet to the store.",
  description: "Add a new pet to the store.",
} as const;
export type AddPetRequest = typeof addPetOperation.request;
export type AddPetResponses = typeof addPetOperation.responses;

export const findPetsByStatusOperation = {
  operationId: "findPetsByStatus",
  method: "get",
  path: "/pet/findByStatus",
  tags: ["pet"],
  security: [
    {
      petstore_auth: ["write:pets", "read:pets"],
    },
  ],
  request: {
    query: z.object({
      status: z.enum(["available", "pending", "sold"]).default("available"),
    }),
    serialization: [
      {
        explode: true,
        "in": "query",
        name: "status",
      },
    ],
  },
  responses: {
    "200": {
      description: "successful operation",
      content: {
        "application/json": z.array(PetSchema),
      },
    },
    "400": {
      description: "Invalid status value",
    },
    "default": {
      description: "Unexpected error",
    },
  },
  summary: "Finds Pets by status.",
  description: "Multiple status values can be provided with comma separated strings.",
} as const;
export type FindPetsByStatusRequest = typeof findPetsByStatusOperation.request;
export type FindPetsByStatusResponses = typeof findPetsByStatusOperation.responses;

export const findPetsByTagsOperation = {
  operationId: "findPetsByTags",
  method: "get",
  path: "/pet/findByTags",
  tags: ["pet"],
  security: [
    {
      petstore_auth: ["write:pets", "read:pets"],
    },
  ],
  request: {
    query: z.object({
      tags: z.array(z.string()),
    }),
    serialization: [
      {
        explode: true,
        "in": "query",
        name: "tags",
      },
    ],
  },
  responses: {
    "200": {
      description: "successful operation",
      content: {
        "application/json": z.array(PetSchema),
      },
    },
    "400": {
      description: "Invalid tag value",
    },
    "default": {
      description: "Unexpected error",
    },
  },
  summary: "Finds Pets by tags.",
  description: "Multiple tags can be provided with comma separated strings. Use tag1, tag2, tag3 for testing.",
} as const;
export type FindPetsByTagsRequest = typeof findPetsByTagsOperation.request;
export type FindPetsByTagsResponses = typeof findPetsByTagsOperation.responses;

export const getPetByIdOperation = {
  operationId: "getPetById",
  method: "get",
  path: "/pet/{petId}",
  tags: ["pet"],
  security: [
    {
      api_key: [],
    },
    {
      petstore_auth: ["write:pets", "read:pets"],
    },
  ],
  request: {
    params: z.object({
      petId: z.int(),
    }),
  },
  responses: {
    "200": {
      description: "successful operation",
      content: {
        "application/json": PetSchema,
      },
    },
    "400": {
      description: "Invalid ID supplied",
    },
    "404": {
      description: "Pet not found",
    },
    "default": {
      description: "Unexpected error",
    },
  },
  summary: "Find pet by ID.",
  description: "Returns a single pet.",
} as const;
export type GetPetByIdRequest = typeof getPetByIdOperation.request;
export type GetPetByIdResponses = typeof getPetByIdOperation.responses;

export const updatePetWithFormOperation = {
  operationId: "updatePetWithForm",
  method: "post",
  path: "/pet/{petId}",
  tags: ["pet"],
  security: [
    {
      petstore_auth: ["write:pets", "read:pets"],
    },
  ],
  request: {
    params: z.object({
      petId: z.int(),
    }),
    query: z.object({
      name: z.string().optional(),
      status: z.string().optional(),
    }),
  },
  responses: {
    "200": {
      description: "successful operation",
      content: {
        "application/json": PetSchema,
      },
    },
    "400": {
      description: "Invalid input",
    },
    "default": {
      description: "Unexpected error",
    },
  },
  summary: "Updates a pet in the store with form data.",
  description: "Updates a pet resource based on the form data.",
} as const;
export type UpdatePetWithFormRequest = typeof updatePetWithFormOperation.request;
export type UpdatePetWithFormResponses = typeof updatePetWithFormOperation.responses;

export const deletePetOperation = {
  operationId: "deletePet",
  method: "delete",
  path: "/pet/{petId}",
  tags: ["pet"],
  security: [
    {
      petstore_auth: ["write:pets", "read:pets"],
    },
  ],
  request: {
    params: z.object({
      petId: z.int(),
    }),
    headers: z.object({
      api_key: z.string().optional(),
    }),
  },
  responses: {
    "200": {
      description: "Pet deleted",
    },
    "400": {
      description: "Invalid pet value",
    },
    "default": {
      description: "Unexpected error",
    },
  },
  summary: "Deletes a pet.",
  description: "Delete a pet.",
} as const;
export type DeletePetRequest = typeof deletePetOperation.request;
export type DeletePetResponses = typeof deletePetOperation.responses;

export const uploadFileOperation = {
  operationId: "uploadFile",
  method: "post",
  path: "/pet/{petId}/uploadImage",
  tags: ["pet"],
  security: [
    {
      petstore_auth: ["write:pets", "read:pets"],
    },
  ],
  request: {
    params: z.object({
      petId: z.int(),
    }),
    query: z.object({
      additionalMetadata: z.string().optional(),
    }),
  },
  responses: {
    "200": {
      description: "successful operation",
      content: {
        "application/json": ApiResponseSchema,
      },
    },
    "400": {
      description: "No file uploaded",
    },
    "404": {
      description: "Pet not found",
    },
    "default": {
      description: "Unexpected error",
    },
  },
  summary: "Uploads an image.",
  description: "Upload image of the pet.",
} as const;
export type UploadFileRequest = typeof uploadFileOperation.request;
export type UploadFileResponses = typeof uploadFileOperation.responses;

export const getInventoryOperation = {
  operationId: "getInventory",
  method: "get",
  path: "/store/inventory",
  tags: ["store"],
  security: [
    {
      api_key: [],
    },
  ],
  request: {},
  responses: {
    "200": {
      description: "successful operation",
      content: {
        "application/json": z.record(z.string(), z.int()),
      },
    },
    "default": {
      description: "Unexpected error",
    },
  },
  summary: "Returns pet inventories by status.",
  description: "Returns a map of status codes to quantities.",
} as const;
export type GetInventoryRequest = typeof getInventoryOperation.request;
export type GetInventoryResponses = typeof getInventoryOperation.responses;

export const placeOrderOperation = {
  operationId: "placeOrder",
  method: "post",
  path: "/store/order",
  tags: ["store"],
  request: {
    body: OrderSchema.optional(),
  },
  responses: {
    "200": {
      description: "successful operation",
      content: {
        "application/json": OrderSchema,
      },
    },
    "400": {
      description: "Invalid input",
    },
    "422": {
      description: "Validation exception",
    },
    "default": {
      description: "Unexpected error",
    },
  },
  summary: "Place an order for a pet.",
  description: "Place a new order in the store.",
} as const;
export type PlaceOrderRequest = typeof placeOrderOperation.request;
export type PlaceOrderResponses = typeof placeOrderOperation.responses;

export const getOrderByIdOperation = {
  operationId: "getOrderById",
  method: "get",
  path: "/store/order/{orderId}",
  tags: ["store"],
  request: {
    params: z.object({
      orderId: z.int(),
    }),
  },
  responses: {
    "200": {
      description: "successful operation",
      content: {
        "application/json": OrderSchema,
      },
    },
    "400": {
      description: "Invalid ID supplied",
    },
    "404": {
      description: "Order not found",
    },
    "default": {
      description: "Unexpected error",
    },
  },
  summary: "Find purchase order by ID.",
  description: "For valid response try integer IDs with value <= 5 or > 10. Other values will generate exceptions.",
} as const;
export type GetOrderByIdRequest = typeof getOrderByIdOperation.request;
export type GetOrderByIdResponses = typeof getOrderByIdOperation.responses;

export const deleteOrderOperation = {
  operationId: "deleteOrder",
  method: "delete",
  path: "/store/order/{orderId}",
  tags: ["store"],
  request: {
    params: z.object({
      orderId: z.int(),
    }),
  },
  responses: {
    "200": {
      description: "order deleted",
    },
    "400": {
      description: "Invalid ID supplied",
    },
    "404": {
      description: "Order not found",
    },
    "default": {
      description: "Unexpected error",
    },
  },
  summary: "Delete purchase order by identifier.",
  description: "For valid response try integer IDs with value < 1000. Anything above 1000 or non-integers will generate API errors.",
} as const;
export type DeleteOrderRequest = typeof deleteOrderOperation.request;
export type DeleteOrderResponses = typeof deleteOrderOperation.responses;

export const createUserOperation = {
  operationId: "createUser",
  method: "post",
  path: "/user",
  tags: ["user"],
  request: {
    body: UserSchema.optional(),
  },
  responses: {
    "200": {
      description: "successful operation",
      content: {
        "application/json": UserSchema,
      },
    },
    "default": {
      description: "Unexpected error",
    },
  },
  summary: "Create user.",
  description: "This can only be done by the logged in user.",
} as const;
export type CreateUserRequest = typeof createUserOperation.request;
export type CreateUserResponses = typeof createUserOperation.responses;

export const createUsersWithListInputOperation = {
  operationId: "createUsersWithListInput",
  method: "post",
  path: "/user/createWithList",
  tags: ["user"],
  request: {
    body: z.array(UserSchema).optional(),
  },
  responses: {
    "200": {
      description: "Successful operation",
      content: {
        "application/json": UserSchema,
      },
    },
    "default": {
      description: "Unexpected error",
    },
  },
  summary: "Creates list of users with given input array.",
  description: "Creates list of users with given input array.",
} as const;
export type CreateUsersWithListInputRequest = typeof createUsersWithListInputOperation.request;
export type CreateUsersWithListInputResponses = typeof createUsersWithListInputOperation.responses;

export const loginUserOperation = {
  operationId: "loginUser",
  method: "get",
  path: "/user/login",
  tags: ["user"],
  request: {
    query: z.object({
      password: z.string().optional(),
      username: z.string().optional(),
    }),
  },
  responses: {
    "200": {
      description: "successful operation",
      headers: z.object({
        "x-expires-after": z.iso.datetime().optional(),
        "x-rate-limit": z.int().optional(),
      }),
      content: {
        "application/json": z.string(),
      },
    },
    "400": {
      description: "Invalid username/password supplied",
    },
    "default": {
      description: "Unexpected error",
    },
  },
  summary: "Logs user into the system.",
  description: "Log into the system.",
} as const;
export type LoginUserRequest = typeof loginUserOperation.request;
export type LoginUserResponses = typeof loginUserOperation.responses;

export const logoutUserOperation = {
  operationId: "logoutUser",
  method: "get",
  path: "/user/logout",
  tags: ["user"],
  request: {},
  responses: {
    "200": {
      description: "successful operation",
    },
    "default": {
      description: "Unexpected error",
    },
  },
  summary: "Logs out current logged in user session.",
  description: "Log user out of the system.",
} as const;
export type LogoutUserRequest = typeof logoutUserOperation.request;
export type LogoutUserResponses = typeof logoutUserOperation.responses;

export const getUserByNameOperation = {
  operationId: "getUserByName",
  method: "get",
  path: "/user/{username}",
  tags: ["user"],
  request: {
    params: z.object({
      username: z.string(),
    }),
  },
  responses: {
    "200": {
      description: "successful operation",
      content: {
        "application/json": UserSchema,
      },
    },
    "400": {
      description: "Invalid username supplied",
    },
    "404": {
      description: "User not found",
    },
    "default": {
      description: "Unexpected error",
    },
  },
  summary: "Get user by user name.",
  description: "Get user detail based on username.",
} as const;
export type GetUserByNameRequest = typeof getUserByNameOperation.request;
export type GetUserByNameResponses = typeof getUserByNameOperation.responses;

export const updateUserOperation = {
  operationId: "updateUser",
  method: "put",
  path: "/user/{username}",
  tags: ["user"],
  request: {
    params: z.object({
      username: z.string(),
    }),
    body: UserSchema.optional(),
  },
  responses: {
    "200": {
      description: "successful operation",
    },
    "400": {
      description: "bad request",
    },
    "404": {
      description: "user not found",
    },
    "default": {
      description: "Unexpected error",
    },
  },
  summary: "Update user resource.",
  description: "This can only be done by the logged in user.",
} as const;
export type UpdateUserRequest = typeof updateUserOperation.request;
export type UpdateUserResponses = typeof updateUserOperation.responses;

export const deleteUserOperation = {
  operationId: "deleteUser",
  method: "delete",
  path: "/user/{username}",
  tags: ["user"],
  request: {
    params: z.object({
      username: z.string(),
    }),
  },
  responses: {
    "200": {
      description: "User deleted",
    },
    "400": {
      description: "Invalid username supplied",
    },
    "404": {
      description: "User not found",
    },
    "default": {
      description: "Unexpected error",
    },
  },
  summary: "Delete user resource.",
  description: "This can only be done by the logged in user.",
} as const;
export type DeleteUserRequest = typeof deleteUserOperation.request;
export type DeleteUserResponses = typeof deleteUserOperation.responses;
