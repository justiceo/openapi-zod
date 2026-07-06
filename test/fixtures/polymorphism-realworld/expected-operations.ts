// AUTO-GENERATED FILE. DO NOT EDIT.

import * as z from "zod";
import { EventSchema } from "./schema.js";

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
