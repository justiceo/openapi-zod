import * as z from "zod";
import { ImportResultSchema, JsonImportSchema } from "./schema.js";

export const importDocumentOperation = {
  operationId: "importDocument",
  method: "post",
  path: "/imports",
  request: {
    body: JsonImportSchema.optional(),
  },
  responses: {
    "200": {
      description: "Imported",
      content: {
        "application/json": ImportResultSchema,
      },
    },
  },
} as const;
export type ImportDocumentRequest = typeof importDocumentOperation.request;
export type ImportDocumentResponses = typeof importDocumentOperation.responses;
