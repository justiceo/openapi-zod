import type { SharedContext } from "./core.js";
import { asRecord, isFiniteNumber, unescapePointer } from "./emit.js";
import type { OperationEntry } from "./operations.js";

export interface OperationExamples {
  request: Record<string, unknown>;
  responses: Record<string, { body?: unknown; headers?: Record<string, unknown> }>;
}

type ExampleContext = Pick<SharedContext, "components" | "schemas" | "options">;

// Deep enough for realistic payloads, shallow enough that wide recursive graphs stay small.
const MAX_EXAMPLE_DEPTH = 12;

const parameterContainers: Record<string, "params" | "query" | "headers" | "cookies"> = {
  path: "params",
  query: "query",
  header: "headers",
  cookie: "cookies",
};

// Builds a best-effort example request and per-status example responses for an operation.
// Explicit OpenAPI examples win; anything missing is synthesized from the schema.
export function operationExamples(entry: OperationEntry, context: ExampleContext): OperationExamples {
  return {
    request: requestExample(entry, context),
    responses: responseExamples(entry, context),
  };
}

function requestExample(entry: OperationEntry, context: ExampleContext): Record<string, unknown> {
  const merged = new Map<string, { container: string; name: string; value: unknown }>();
  const parameters = [
    ...(Array.isArray(entry.pathItem.parameters) ? entry.pathItem.parameters : []),
    ...(Array.isArray(entry.operation.parameters) ? entry.operation.parameters : []),
  ];
  for (const raw of parameters) {
    const parameter = resolveComponent(raw, "parameters", context);
    if (!parameter || typeof parameter.name !== "string" || typeof parameter.in !== "string") {
      continue;
    }
    const container = parameterContainers[parameter.in];
    if (!container) {
      continue;
    }
    const explicit = explicitExample(parameter);
    const required = parameter.in === "path" || parameter.required === true;
    if (!required && explicit === undefined) {
      merged.delete(`${container}:${parameter.name}`);
      continue;
    }
    const value =
      explicit ??
      (parameter.schema !== undefined
        ? schemaExample(parameter.schema, context)
        : mediaExample(selectMedia(parameter.content, context), context));
    const name = parameter.in === "header" ? parameter.name.toLowerCase() : parameter.name;
    merged.set(`${container}:${parameter.name}`, { container, name, value: value ?? "example" });
  }

  const request: Record<string, unknown> = {};
  for (const { container, name, value } of merged.values()) {
    request[container] = { ...(request[container] as Record<string, unknown> | undefined), [name]: value };
  }

  const body = resolveComponent(entry.operation.requestBody, "requestBodies", context);
  const media = body ? selectMedia(body.content, context) : undefined;
  if (media) {
    const value = mediaExample(media, context);
    if (value !== undefined) {
      request.body = value;
    }
  }
  return request;
}

function responseExamples(entry: OperationEntry, context: ExampleContext): OperationExamples["responses"] {
  const responses = asRecord(entry.operation.responses) ?? {};
  const result: OperationExamples["responses"] = {};
  for (const key of Object.keys(responses)) {
    const response = resolveComponent(responses[key], "responses", context);
    const example: { body?: unknown; headers?: Record<string, unknown> } = {};
    const media = response ? selectMedia(response.content, context) : undefined;
    if (media) {
      const value = mediaExample(media, context);
      if (value !== undefined) {
        example.body = value;
      }
    }
    result[key] = example;
  }
  return result;
}

// Mirrors components.ts: only configured media types are considered, and an ambiguous
// (multi-media) body has no single schema to synthesize against.
function selectMedia(content: unknown, context: ExampleContext): Record<string, unknown> | undefined {
  const object = asRecord(content);
  if (!object) {
    return undefined;
  }
  const matching = context.options.mediaTypes.filter((mediaType) => object[mediaType] !== undefined);
  return matching.length > 0 ? asRecord(object[matching[0]!]) : undefined;
}

function mediaExample(media: Record<string, unknown> | undefined, context: ExampleContext): unknown {
  if (!media) {
    return undefined;
  }
  return explicitExample(media) ?? (media.schema !== undefined ? schemaExample(media.schema, context) : undefined);
}

// `example`, or the first `examples` entry carrying an inline value (externalValue is skipped).
function explicitExample(object: Record<string, unknown>): unknown {
  if (object.example !== undefined) {
    return object.example;
  }
  const examples = asRecord(object.examples);
  if (!examples) {
    return undefined;
  }
  for (const key of Object.keys(examples)) {
    const value = asRecord(examples[key])?.value;
    if (value !== undefined) {
      return value;
    }
  }
  return undefined;
}

function resolveComponent(
  value: unknown,
  kind: "parameters" | "requestBodies" | "responses",
  context: ExampleContext,
): Record<string, unknown> | undefined {
  let current = asRecord(value);
  const seen = new Set<string>();
  while (current && typeof current.$ref === "string") {
    const prefix = `#/components/${kind}/`;
    if (!current.$ref.startsWith(prefix) || seen.has(current.$ref)) {
      return undefined;
    }
    seen.add(current.$ref);
    current = asRecord(asRecord(context.components[kind])?.[unescapePointer(current.$ref.slice(prefix.length))]);
  }
  return current;
}

function schemaExample(schema: unknown, context: ExampleContext): unknown {
  return synthesize(schema, context, new Set(), 0);
}

function synthesize(schema: unknown, context: ExampleContext, refs: Set<string>, depth: number): unknown {
  if (schema === true) {
    return null;
  }
  const object = asRecord(schema);
  if (!object || depth > MAX_EXAMPLE_DEPTH) {
    return undefined;
  }
  if (typeof object.$ref === "string") {
    const prefix = "#/components/schemas/";
    if (!object.$ref.startsWith(prefix) || refs.has(object.$ref)) {
      return undefined;
    }
    const target = context.schemas[unescapePointer(object.$ref.slice(prefix.length))];
    const next = new Set(refs).add(object.$ref);
    return synthesize(target, context, next, depth + 1);
  }

  const explicit =
    object.example !== undefined
      ? object.example
      : Array.isArray(object.examples) && object.examples.length > 0
        ? object.examples[0]
        : object.default !== undefined
          ? object.default
          : object.const !== undefined
            ? object.const
            : Array.isArray(object.enum)
              ? (object.enum.find((value) => value !== null) ?? object.enum[0])
              : undefined;
  if (explicit !== undefined) {
    return explicit;
  }

  if (Array.isArray(object.allOf)) {
    const parts = object.allOf.map((part) => synthesize(part, context, refs, depth + 1));
    const sibling =
      object.type !== undefined || object.properties !== undefined
        ? synthesizeType(object, context, refs, depth)
        : undefined;
    return mergeExamples([...parts, sibling]);
  }
  for (const key of ["oneOf", "anyOf"] as const) {
    const options = object[key];
    if (Array.isArray(options)) {
      const nonNull = options.find((option) => asRecord(option)?.type !== "null") ?? options[0];
      const variant = synthesize(nonNull, context, refs, depth + 1);
      const base = object.properties !== undefined ? synthesizeType(object, context, refs, depth) : undefined;
      return base === undefined ? variant : mergeExamples([base, variant]);
    }
  }
  return synthesizeType(object, context, refs, depth);
}

function synthesizeType(
  object: Record<string, unknown>,
  context: ExampleContext,
  refs: Set<string>,
  depth: number,
): unknown {
  const types = Array.isArray(object.type) ? object.type : [object.type];
  const type =
    types.find((item) => typeof item === "string" && item !== "null") ??
    (object.properties !== undefined ? "object" : object.items !== undefined ? "array" : types[0]);
  switch (type) {
    case "string":
      return stringExample(object);
    case "integer":
    case "number":
      return numberExample(object, type === "integer");
    case "boolean":
      return true;
    case "null":
      return null;
    case "array": {
      const item = synthesize(object.items, context, refs, depth + 1);
      if (item === undefined) {
        return [];
      }
      const count = isFiniteNumber(object.minItems) && object.minItems > 1 ? object.minItems : 1;
      return Array.from({ length: count }, () => item);
    }
    case "object":
      return objectExample(object, context, refs, depth);
    default:
      return null;
  }
}

function objectExample(
  object: Record<string, unknown>,
  context: ExampleContext,
  refs: Set<string>,
  depth: number,
): Record<string, unknown> {
  const properties = asRecord(object.properties) ?? {};
  const required = new Set(
    Array.isArray(object.required) ? object.required.filter((key): key is string => typeof key === "string") : [],
  );
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(properties)) {
    const property = asRecord(properties[key]);
    if (property?.readOnly === true && !required.has(key)) {
      continue;
    }
    const hasExplicit = property !== undefined && (property.example !== undefined || property.examples !== undefined);
    if (required.size > 0 && !required.has(key) && !hasExplicit) {
      continue;
    }
    const value = synthesize(properties[key], context, refs, depth + 1);
    if (value !== undefined) {
      result[key] = value;
    } else if (required.has(key)) {
      result[key] = null;
    }
  }
  return result;
}

const formatExamples: Record<string, string> = {
  uuid: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  email: "user@example.com",
  "idn-email": "user@example.com",
  "date-time": "2024-01-01T00:00:00Z",
  date: "2024-01-01",
  time: "12:00:00Z",
  duration: "P1D",
  uri: "https://example.com",
  url: "https://example.com",
  "uri-reference": "https://example.com",
  iri: "https://example.com",
  hostname: "example.com",
  "idn-hostname": "example.com",
  ipv4: "192.0.2.1",
  ipv6: "2001:db8::1",
  byte: "ZXhhbXBsZQ==",
  password: "password",
};

function stringExample(object: Record<string, unknown>): string {
  let value = (typeof object.format === "string" ? formatExamples[object.format] : undefined) ?? "string";
  if (isFiniteNumber(object.minLength) && value.length < object.minLength) {
    value = value.padEnd(object.minLength, "x");
  }
  if (isFiniteNumber(object.maxLength) && value.length > object.maxLength) {
    value = value.slice(0, object.maxLength);
  }
  return value;
}

function numberExample(object: Record<string, unknown>, integer: boolean): number {
  const step = integer ? 1 : 0.5;
  let value = 0;
  if (isFiniteNumber(object.minimum)) {
    value = object.minimum + (object.exclusiveMinimum === true ? step : 0);
  } else if (isFiniteNumber(object.exclusiveMinimum)) {
    value = object.exclusiveMinimum + step;
  } else if (isFiniteNumber(object.maximum) && object.maximum < 0) {
    value = object.maximum - (object.exclusiveMaximum === true ? step : 0);
  } else if (isFiniteNumber(object.exclusiveMaximum) && object.exclusiveMaximum <= 0) {
    value = object.exclusiveMaximum - step;
  }
  if (isFiniteNumber(object.multipleOf) && object.multipleOf > 0) {
    value = Math.ceil(value / object.multipleOf) * object.multipleOf;
  }
  return integer ? Math.ceil(value) : value;
}

function mergeExamples(values: unknown[]): unknown {
  const defined = values.filter((value) => value !== undefined);
  if (defined.length === 0) {
    return undefined;
  }
  if (defined.every((value) => asRecord(value) !== undefined)) {
    return Object.assign({}, ...defined);
  }
  return defined[defined.length - 1];
}
