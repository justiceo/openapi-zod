# OpenAPI to Zod Converter Design

## Summary

Build a lean TypeScript package that converts OpenAPI 3.0.x and 3.1.x documents into Zod 4 validators and route metadata. The package exposes an importable library API and a thin CLI. The library is pure with respect to the filesystem: it returns generated output descriptors in memory and never creates directories or writes files. The CLI owns file-based input/output. The default output is readable TypeScript containing named Zod schema exports, inferred TypeScript types, operation-level request and response validators, reusable parameter/header/security validators, and deterministic route definitions.

The implementation must be fixture driven. Before broad converter work, add representative OpenAPI fixtures and manually authored expected Zod output files. These fixtures define the converter's behavior, diagnostics, ordering, and CLI parity.

The implementation prioritizes deterministic output, maintainable conversion rules, explicit diagnostics, and a small dependency surface over full JSON Schema feature parity or framework-specific server/client generation.

## References

Implementation decisions in this document assume:

- Zod 4 is imported with `import * as z from "zod";`.
- Zod 4 supports top-level string format helpers such as `z.email()`, `z.uuid()`, `z.url()`, and ISO helpers under `z.iso`.
- Zod 4 supports `z.int()`, `z.strictObject(...)`, `z.looseObject(...)`, `.catchall(...)`, `z.record(keySchema, valueSchema)`, `z.union(...)`, `z.intersection(...)`, `.optional()`, `.nullable()`, and `.default(...)`.
- OpenAPI 3.1 schemas align with JSON Schema 2020-12, including `type` arrays such as `["string", "null"]`.
- OpenAPI 3.0 uses `nullable: true` and boolean `exclusiveMinimum` / `exclusiveMaximum` modifiers.

## Goals

- Convert OpenAPI 3.0.x and 3.1.x documents into Zod 4 code for schemas, routes, operation inputs, operation outputs, reusable components, and security metadata.
- Convert schemas under `components.schemas` into reusable named Zod schema exports.
- Convert route operations under `paths` into stable operation exports with method, path, operationId, tags, request validators, response validators, and security requirements.
- Convert reusable `components.parameters`, `components.requestBodies`, `components.responses`, `components.headers`, `components.securitySchemes`, and selected inline equivalents.
- Generate validator groupings for path parameters, query parameters, header parameters, cookie parameters, request bodies, response bodies, response headers, and security credentials.
- Preserve useful document metadata such as `info`, `servers`, top-level `tags`, and `externalDocs` in generated exports.
- Generate readable, stable TypeScript output that can be written by callers, committed, or consumed by application code.
- Provide a small programmatic API for build tools and custom integrations.
- Provide a CLI for file-based conversion.
- Keep filesystem side effects out of the library so converter behavior can be tested directly with in-memory inputs and outputs.
- Report unsupported, invalid, ambiguous, or lossy conversions through structured diagnostics.
- Keep the architecture small enough to reason about and extend.
- Drive implementation from manually authored fixture inputs, expected outputs, and expected diagnostics.

## Non-Goals

- Swagger 2.0 support.
- Full JSON Schema 2020-12 feature parity.
- Complete OpenAPI document validation beyond checks required for conversion.
- SDK generation, generated HTTP clients, route handlers, server stubs, framework adapters, or executable authorization middleware.
- External `$ref` resolution in the initial comprehensive release.
- Runtime validators for OpenAPI documents.
- Opinionated code formatting beyond deterministic generated TypeScript.
- Semantic validation that a security credential is authorized for an operation. Generated security validators only validate credential shape and location.

## Package Shape

Recommended initial files:

```text
src/
  index.ts
  cli.ts
  loader.ts
  normalizer.ts
  refs.ts
  converter.ts
  generator.ts
  routes.ts
  operations.ts
  security.ts
  diagnostics.ts
test/
  fixtures/
    primitives/
      openapi.yaml
      expected.ts
      diagnostics.json
```

Recommended dependencies:

- Runtime: `zod`, a YAML parser such as `yaml`.
- Development: TypeScript, a test runner, and a CLI runner for smoke tests.

Do not add a formatter as a runtime dependency in the initial comprehensive release. Generated code must be deterministic by construction.

## Public API

Expose a small API centered on one conversion function:

```ts
export type ConvertOpenApiToZodOptions = {
  outputMode?: "singleFile";
  outputFileName?: string;
  schemaNamePrefix?: string;
  schemaNameSuffix?: string;
  operationNamePrefix?: string;
  operationNameSuffix?: string;
  includeInferredTypes?: boolean;
  includeRouteMap?: boolean;
  includeOperationTypes?: boolean;
  includeSecurityValidators?: boolean;
  includeDocumentMetadata?: boolean;
  strictObjects?: boolean;
  mediaTypes?: string[];
  includeDeprecated?: boolean;
  onUnsupported?: "warn" | "error";
};

export type ConversionDiagnostic = {
  level: "warning" | "error";
  code: string;
  message: string;
  path?: string;
};

export type GeneratedOutput = {
  path: string;
  contents: string;
};

export type ConversionResult = {
  outputs: GeneratedOutput[];
  diagnostics: ConversionDiagnostic[];
};

export function convertOpenApiToZod(
  document: unknown,
  options?: ConvertOpenApiToZodOptions,
): ConversionResult;
```

Default options:

| Option | Default |
| --- | --- |
| `outputMode` | `"singleFile"` |
| `outputFileName` | `"schemas.ts"` |
| `schemaNamePrefix` | `""` |
| `schemaNameSuffix` | `"Schema"` |
| `operationNamePrefix` | `""` |
| `operationNameSuffix` | `"Operation"` |
| `includeInferredTypes` | `true` |
| `includeRouteMap` | `true` |
| `includeOperationTypes` | `true` |
| `includeSecurityValidators` | `true` |
| `includeDocumentMetadata` | `true` |
| `strictObjects` | `false` |
| `mediaTypes` | `["application/json"]` |
| `includeDeprecated` | `true` |
| `onUnsupported` | `"warn"` |

Default output behavior:

- Return one generated output descriptor with `path: "schemas.ts"`.
- Use `import * as z from "zod";`.
- Emit named schema exports such as `export const UserSchema = z.object(...)`.
- Emit inferred type exports such as `export type User = z.infer<typeof UserSchema>;`.
- Emit named operation exports such as `export const getUserOperation = { ... } as const;`.
- Emit a route map export such as `export const routes = [getUserOperation, createUserOperation] as const;`.
- Emit reusable security scheme validators such as `export const BearerAuthSecurity = z.object(...)`.
- Emit document metadata such as `export const openApiMetadata = { ... } as const;`.
- Sort component schema names lexicographically before generation.
- Sort component parameters, request bodies, responses, headers, and security schemes lexicographically before generation.
- Sort paths lexicographically, then operations by HTTP method order: `get`, `put`, `post`, `delete`, `options`, `head`, `patch`, `trace`.
- Sort generated object property keys lexicographically unless preserving OpenAPI order is explicitly chosen later.
- Return diagnostics with stable codes and stable paths.
- Perform no filesystem writes, directory creation, path existence checks, or process exits.
- If `onUnsupported: "error"` is set, unsupported-feature diagnostics have level `"error"` but the function still returns generated outputs when generation can continue.

## CLI

Provide a thin CLI wrapper around the library:

```sh
openapi-zod --input openapi.yaml --output src/generated
```

Supported flags:

- `--input <path>`: required path to an OpenAPI JSON or YAML file.
- `--output <dir>`: required output directory.
- `--output-file <name>`: optional generated file name, default `schemas.ts`.
- `--name-prefix <value>`: optional prefix for generated schema names.
- `--name-suffix <value>`: optional suffix, default `Schema`.
- `--operation-prefix <value>`: optional prefix for generated operation names.
- `--operation-suffix <value>`: optional suffix, default `Operation`.
- `--no-types`: skip inferred `z.infer` type exports.
- `--no-route-map`: skip the aggregate `routes` export.
- `--no-operation-types`: skip operation request and response inferred type exports.
- `--no-security-validators`: skip generated security credential validators.
- `--no-metadata`: skip the generated document metadata export.
- `--strict-objects`: generate strict object schemas according to the object and record rules below.
- `--media-type <value>`: include an additional request/response body media type; may be repeated.
- `--exclude-deprecated`: skip deprecated operations and deprecated reusable components when possible.
- `--fail-on-warning`: exit non-zero when warnings are produced.

The CLI must:

- Load JSON and YAML inputs.
- Call `convertOpenApiToZod`.
- Write all returned generated outputs into the output directory.
- Create the output directory when it does not exist.
- Print diagnostics to stderr in a stable format: `<level> <code> <path> <message>`.
- Exit `0` when there are no errors and `--fail-on-warning` is not triggered.
- Exit `1` on conversion errors or warnings when `--fail-on-warning` is set.
- Contain no conversion behavior that is not also available through the library API; CLI-only behavior is limited to loading inputs, writing outputs, printing diagnostics, and choosing process exit codes.

## Conversion Scope

The converter covers the OpenAPI document surfaces required to validate application boundaries:

- `components.schemas`
- `components.parameters`
- `components.requestBodies`
- `components.responses`
- `components.headers`
- `components.securitySchemes`
- `info`, `servers`, `tags`, and `externalDocs` as document metadata
- global `security`
- `paths`, path items, operations, parameters, request bodies, responses, response headers, and operation-level security
- inline schemas reachable from these locations

The converter does not generate executable HTTP clients or server handlers. Route exports are declarative metadata plus Zod validators that downstream adapters can consume.

The converter must accept OpenAPI documents whose `openapi` field starts with `3.0.` or `3.1.`. Missing or unsupported versions must produce `invalid.openapiVersion`.

If `components.schemas` is missing or empty, continue route and component conversion and emit warning diagnostic `empty.componentsSchemas`. If `paths` is missing or empty, continue component conversion and emit warning diagnostic `empty.paths`. If both are empty, return a valid generated file containing the Zod import and empty route map when `includeRouteMap` is enabled.

## Output Shape

Generated operation exports must be plain, serializable-enough metadata with Zod schemas attached:

```ts
export const getUserOperation = {
  operationId: "getUser",
  method: "get",
  path: "/users/{userId}",
  tags: ["Users"],
  deprecated: false,
  security: [{ BearerAuth: [] }],
  request: {
    params: z.object({ userId: z.uuid() }),
    query: z.object({ includePosts: z.boolean().optional() }),
    headers: z.object({ "x-request-id": z.string().optional() }),
    cookies: z.object({}),
    body: undefined,
  },
  responses: {
    200: {
      description: "User response",
      headers: z.object({ etag: z.string().optional() }),
      content: {
        "application/json": UserSchema,
      },
    },
    default: {
      description: "Error response",
      content: {
        "application/json": ErrorSchema,
      },
    },
  },
} as const;
```

Request containers must always be emitted with stable keys:

- `params`: path parameters.
- `query`: query parameters.
- `headers`: header parameters.
- `cookies`: cookie parameters.
- `body`: request body content map or `undefined`.

Empty parameter containers emit `z.object({})`. Required parameter and request body rules are applied at their container boundary. Optional parameters append `.optional()` to the parameter value schema. Optional request bodies emit body schema unions that allow absence according to the request body rules below.

## Metadata Rules

When `includeDocumentMetadata` is true, emit a stable `openApiMetadata` export containing non-validator document metadata:

- `openapi`
- `info.title`, `info.version`, `info.summary`, `info.description`, and `info.termsOfService`
- `servers` with `url`, `description`, and literal `variables`
- top-level `tags` with `name`, `description`, and `externalDocs`
- top-level `externalDocs`

Metadata rules:

- Invalid metadata shapes emit diagnostics but do not block validator generation.
- Server variable enums and defaults are emitted as metadata, not validators.
- Vendor extensions are omitted unless a future option explicitly preserves them.
- Metadata string values are emitted with `JSON.stringify`.

## Normalization Rules

Normalize OpenAPI differences before conversion:

- OpenAPI 3.0 `nullable: true` wraps the converted schema in `.nullable()` when the schema has an explicit `type`; without an explicit `type`, emit `ambiguous.type`.
- OpenAPI 3.1 `type: ["T", "null"]` wraps the non-null type conversion in `.nullable()`.
- OpenAPI 3.1 `type` arrays with more than one non-null type convert to `z.union([...])` when each branch is otherwise supported.
- OpenAPI 3.0 `exclusiveMinimum: true` plus `minimum: n` becomes `.gt(n)`.
- OpenAPI 3.0 `exclusiveMaximum: true` plus `maximum: n` becomes `.lt(n)`.
- OpenAPI 3.1 numeric `exclusiveMinimum: n` becomes `.gt(n)`.
- OpenAPI 3.1 numeric `exclusiveMaximum: n` becomes `.lt(n)`.
- `required` arrays affect only object properties; a nullable optional property becomes `schema.nullable().optional()`.
- Sibling keywords next to `$ref` are unsupported in the initial comprehensive release except OpenAPI 3.0 `nullable: true`; emit `unsupported.refSibling` when ignored or when conversion cannot preserve them.
- Vendor extensions beginning with `x-` are ignored without diagnostics.

## Reference Resolution

The initial comprehensive release supports local references only:

- Supported schema `$ref` format: `#/components/schemas/<Name>`.
- Supported reusable component `$ref` formats:
  - `#/components/parameters/<Name>`
  - `#/components/requestBodies/<Name>`
  - `#/components/responses/<Name>`
  - `#/components/headers/<Name>`
  - `#/components/securitySchemes/<Name>`
- References to generated component schemas emit the generated schema symbol.
- References to reusable non-schema components inline or reuse the corresponding generated validator/metadata symbol according to the target kind.
- Unknown local references emit `invalid.ref`.
- External references such as `./common.yaml#/Foo` emit `unsupported.externalRef`.
- Circular references use `z.lazy(() => OtherSchema)` at the reference site when a cycle is detected.
- Self-references must also use `z.lazy(() => SelfSchema)`.

Reference detection must build dependency graphs before generation:

- A schema dependency graph for `components.schemas`.
- A component dependency graph for reusable parameters, headers, request bodies, responses, and security schemes.
- An operation dependency graph for each path operation's reachable schemas and reusable components.

These graphs are used to:

- Detect cycles deterministically.
- Decide when a `$ref` expression needs `z.lazy`.
- Generate component and operation symbols in stable order.
- Attach diagnostics to the path where the reference was used, not only where the referenced component was defined.

## Zod Mapping Rules

Core mappings:

| OpenAPI / JSON Schema | Zod output |
| --- | --- |
| `type: "string"` | `z.string()` |
| `type: "number"` | `z.number()` |
| `type: "integer"` | `z.int()` |
| `type: "boolean"` | `z.boolean()` |
| `type: "null"` | `z.null()` |
| `type: "array"` | `z.array(itemSchema)` |
| `type: "object"` with `properties` | `z.object({ ... })` or `z.strictObject({ ... })` |
| no type with `properties` | infer object schema and emit `ambiguous.type` warning |
| `enum` with string-only values | `z.enum([...])` |
| `enum` with mixed primitive values | `z.union([z.literal(...), ...])` |
| single-value `enum` | `z.literal(value)` |
| `const` | `z.literal(value)` |
| `$ref` | generated schema symbol or `z.lazy(() => Symbol)` |
| `oneOf` | `z.union([...])` only when each branch is supported |
| `anyOf` | `z.union([...])` only when each branch is supported |
| `allOf` | object merge or `z.intersection(...)` according to the composition rules below |
| nullable schema | `.nullable()` |
| optional property | `.optional()` |
| `default` | `.default(value)` when value is JSON-literal-safe and assignable enough to emit |

Primitive literal values supported in `enum`, `const`, and `default`:

- string
- finite number
- boolean
- null
- arrays and objects composed only of supported JSON-literal-safe values

Unsupported literal values must produce `unsafe.literal` or `unsafe.default`.

## String Rules

Start string schemas from a base:

- `format: email` -> `z.email()`
- `format: uuid` -> `z.uuid()`
- `format: uri` or `format: url` -> `z.url()`
- `format: date-time` -> `z.iso.datetime()`
- `format: date` -> `z.iso.date()`
- unknown `format` -> `z.string()` with `unsupported.format`

Then apply straightforward constraints where compatible:

- `minLength: n` -> `.min(n)`
- `maxLength: n` -> `.max(n)`
- `pattern: p` -> `.regex(new RegExp(p))` only when the pattern can be emitted safely as a JS string

If both `format` and constraints are present, apply constraints to the format schema, for example `z.email().max(255)`.

## Number Rules

Number and integer constraints:

- `minimum: n` -> `.gte(n)` unless OpenAPI 3.0 `exclusiveMinimum: true` applies
- `maximum: n` -> `.lte(n)` unless OpenAPI 3.0 `exclusiveMaximum: true` applies
- numeric `exclusiveMinimum: n` in OpenAPI 3.1 -> `.gt(n)`
- numeric `exclusiveMaximum: n` in OpenAPI 3.1 -> `.lt(n)`
- `multipleOf: n` -> `.multipleOf(n)`

Invalid numeric constraints, non-finite numbers, or OpenAPI-version-incompatible exclusive forms must emit `invalid.numericConstraint`.

## Array Rules

- `items` is required for precise array conversion.
- Missing `items` maps to `z.array(z.unknown())` with `ambiguous.arrayItems`.
- `minItems: n` -> `.min(n)`.
- `maxItems: n` -> `.max(n)`.
- `uniqueItems: true` is unsupported initially because Zod arrays do not provide a direct JSON-deep-uniqueness check; emit `unsupported.uniqueItems`.
- OpenAPI 3.1 tuple forms such as `prefixItems` are unsupported initially; emit `unsupported.tuple`.

## Object and Record Rules

Object base behavior:

- With `strictObjects: false`, emit `z.object({ ... })`.
- With `strictObjects: true`, emit `z.strictObject({ ... })`.
- Required properties are emitted as their schema.
- Non-required properties append `.optional()`.
- Property names that are not valid identifiers must be quoted.

`additionalProperties` behavior:

| Shape | Output |
| --- | --- |
| schema has no `properties`, `additionalProperties` is a schema | `z.record(z.string(), valueSchema)` |
| schema has no `properties`, `additionalProperties: true` or omitted | `z.record(z.string(), z.unknown())` with `ambiguous.recordValue` when inferred from omitted type |
| schema has properties and `additionalProperties` is a schema | `z.object({ ... }).catchall(valueSchema)` |
| schema has properties and `additionalProperties: true` | default `z.object({ ... })`; use `z.looseObject({ ... })` only if needed for explicit pass-through |
| schema has properties and `additionalProperties: false` | `z.strictObject({ ... })` regardless of `strictObjects` |
| schema has properties, omitted `additionalProperties`, `strictObjects: true` | `z.strictObject({ ... })` |

OpenAPI 3.1 `patternProperties`, `propertyNames`, `unevaluatedProperties`, `minProperties`, and `maxProperties` are unsupported initially unless straightforward support is added with tests. Emit diagnostics rather than silently dropping behavior.

## Composition Rules

Composition is safe only when generated Zod behavior is clearly equivalent enough for the initial comprehensive release:

- `oneOf` and `anyOf` both map to `z.union([...])` only for schemas without discriminators and without branch interactions that require exact-one semantics.
- If `oneOf` branches can overlap, emit `unsupported.composition.oneOfOverlap` because `z.union` does not enforce exactly one matching branch.
- `discriminator` is unsupported initially; emit `unsupported.discriminator`.
- `allOf` with object schemas can merge properties when there are no conflicting property definitions and compatible `required` arrays.
- `allOf` with non-object branches can map to nested `z.intersection(a, b)` when both branches are independently supported.
- Conflicting `allOf` properties emit `unsupported.composition.conflict`.

## Path and Operation Rules

Generate one operation export for every supported operation under `paths`.

Path item rules:

- Path keys must start with `/`; invalid paths emit `invalid.path`.
- Path-level `parameters` apply to every operation under that path.
- Operation-level parameters override path-level parameters by matching `name` plus `in`.
- Path templating names such as `/users/{userId}` must have a matching path parameter. Missing path parameter definitions emit `invalid.pathParameter`.
- Defined path parameters that do not appear in the path template emit `invalid.pathParameter`.
- Path item `$ref` is unsupported unless support is explicitly added with fixtures; emit `unsupported.pathItemRef`.
- Path item fields `summary`, `description`, and vendor extensions do not affect generated validators.

Operation rules:

- Supported methods are `get`, `put`, `post`, `delete`, `options`, `head`, `patch`, and `trace`.
- Operation names use `operationId` when present. Missing `operationId` produces a deterministic name from method plus path, for example `getUsersUserIdOperation`, and emits `ambiguous.operationId`.
- Duplicate or sanitized-colliding operation names are resolved deterministically with `_2`, `_3`, and so on, and emit `name.collision`.
- Operation exports include `operationId`, `method`, `path`, `tags`, `deprecated`, `security`, `request`, and `responses`.
- `tags` emit as sorted unique strings unless preserving operation order is explicitly chosen later.
- Deprecated operations are emitted by default and skipped only when `includeDeprecated: false`.
- `callbacks` and `links` are unsupported in the initial comprehensive scope; emit diagnostics rather than silently dropping them.

## Parameter Rules

Parameters are converted from path-level, operation-level, and `components.parameters` definitions.

Parameter location mapping:

| OpenAPI parameter `in` | Operation request key |
| --- | --- |
| `path` | `params` |
| `query` | `query` |
| `header` | `headers` |
| `cookie` | `cookies` |

Conversion rules:

- Parameter identity is `name` plus `in`.
- `schema` parameters convert the schema and place it under the corresponding request container key.
- `content` parameters are supported only when exactly one configured media type is present and its schema is supported.
- Path parameters are always required; `required: false` on a path parameter emits `invalid.pathParameter`.
- Non-path parameters are optional unless `required: true`.
- Header names are normalized to lower case in generated object keys to match HTTP case-insensitivity.
- Cookie and query names preserve OpenAPI spelling.
- `style`, `explode`, `allowReserved`, and `allowEmptyValue` are metadata-sensitive serialization concerns. Unsupported combinations emit `unsupported.parameterSerialization`; simple defaults are accepted without diagnostics.
- `deprecated: true` parameters are emitted by default and skipped only when `includeDeprecated: false`.

Default serialization support:

| Location | Supported default |
| --- | --- |
| `path` | `style: simple`, `explode: false` |
| `query` | `style: form`, primitive values, arrays with `explode: true` or `false` |
| `header` | `style: simple`, primitive values and arrays |
| `cookie` | `style: form`, primitive values |

## Request Body Rules

Request bodies are converted from operation-level `requestBody` and `components.requestBodies`.

- `$ref` request bodies reuse the resolved component request body conversion.
- `content` entries are filtered by `mediaTypes`.
- When no configured media type is present, emit `unsupported.mediaType` and set `body` to `undefined`.
- Each included media type maps to its converted schema.
- Missing `schema` under a selected media type emits `ambiguous.requestBodySchema` and maps to `z.unknown()`.
- `required: true` means the body must be present.
- `required: false` or omitted means the body may be absent.
- For a single selected media type, emit the body schema directly when required, or `schema.optional()` when optional.
- For multiple selected media types, emit a content map keyed by media type so callers can choose by `Content-Type`.
- `encoding` is unsupported in the initial comprehensive scope and emits `unsupported.encoding` when it affects selected content.

## Response Rules

Responses are converted from operation `responses` and `components.responses`.

- Every operation must define `responses`; missing responses emit `invalid.responses`.
- Response keys must be HTTP status codes, status code ranges such as `2XX`, or `default`; invalid keys emit `invalid.responseStatus`.
- Response descriptions are emitted as string metadata.
- Response content entries are filtered by `mediaTypes`.
- Responses with no selected content emit an empty `content` object without diagnostics when no content is expected, such as `204`.
- Responses with selected content but missing schema emit `ambiguous.responseBodySchema` and map to `z.unknown()`.
- Response headers convert using header component rules and emit under a `headers` object schema.
- Response `links` are unsupported in the initial comprehensive scope and emit `unsupported.links`.

## Header Rules

Headers are converted from `components.headers` and inline response headers.

- Header schema conversion follows parameter schema rules except there is no `name` or `in` field in the Header Object.
- Header object `required` is not part of OpenAPI Header Object; response headers are optional by default unless a future extension explicitly marks them required.
- Header names are normalized to lower case in generated object keys.
- Header `content` is supported only when exactly one configured media type is present and its schema is supported.
- Unsupported serialization emits `unsupported.headerSerialization`.

## Security Scheme Rules

Security schemes are converted from `components.securitySchemes` and linked to global or operation-level `security` requirements.

Generated security validators validate credential shape and location, not authorization semantics.

Supported security scheme mappings:

| OpenAPI security scheme | Generated validator shape |
| --- | --- |
| `type: "apiKey"`, `in: "header"` | `z.object({ headers: z.object({ "<name>": z.string() }) })` |
| `type: "apiKey"`, `in: "query"` | `z.object({ query: z.object({ "<name>": z.string() }) })` |
| `type: "apiKey"`, `in: "cookie"` | `z.object({ cookies: z.object({ "<name>": z.string() }) })` |
| `type: "http"`, `scheme: "basic"` | `z.object({ headers: z.object({ authorization: z.string().regex(...) }) })` |
| `type: "http"`, `scheme: "bearer"` | `z.object({ headers: z.object({ authorization: z.string().regex(...) }) })` |
| `type: "oauth2"` | metadata export plus token-bearing `authorization` header validator |
| `type: "openIdConnect"` | metadata export plus token-bearing `authorization` header validator |

Security requirement rules:

- Operation-level `security` overrides global `security`.
- Missing operation-level `security` inherits global `security`.
- Empty operation-level `security: []` means no security is required.
- Each object in a security requirement array represents alternatives; keys inside one object are combined requirements.
- Unknown security scheme names emit `invalid.securityScheme`.
- OAuth2 scope arrays are emitted as metadata. Scope existence is validated against the scheme's declared flows when possible; unknown scopes emit `invalid.securityScope`.
- Unsupported HTTP auth schemes emit `unsupported.securityScheme`.
- Malformed OAuth2 flows or OpenID Connect URLs emit `invalid.securityScheme`.

## Diagnostics

Diagnostics must be structured and stable enough for tests and CI.

Required diagnostic fields:

- `level`: `"warning"` or `"error"`
- `code`: machine-readable string
- `message`: human-readable text
- `path`: JSON Pointer-like OpenAPI path when available, for example `#/components/schemas/User/properties/id`

Initial diagnostic codes:

- `empty.componentsSchemas`
- `empty.paths`
- `invalid.openapiVersion`
- `invalid.path`
- `invalid.pathParameter`
- `invalid.operation`
- `invalid.metadata`
- `invalid.responses`
- `invalid.responseStatus`
- `invalid.ref`
- `invalid.schema`
- `invalid.parameter`
- `invalid.requestBody`
- `invalid.response`
- `invalid.header`
- `invalid.securityScheme`
- `invalid.securityScope`
- `invalid.numericConstraint`
- `ambiguous.type`
- `ambiguous.operationId`
- `ambiguous.arrayItems`
- `ambiguous.recordValue`
- `ambiguous.requestBodySchema`
- `ambiguous.responseBodySchema`
- `unsafe.default`
- `unsafe.literal`
- `unsupported.keyword`
- `unsupported.format`
- `unsupported.externalRef`
- `unsupported.refSibling`
- `unsupported.pathItemRef`
- `unsupported.parameterSerialization`
- `unsupported.headerSerialization`
- `unsupported.mediaType`
- `unsupported.encoding`
- `unsupported.links`
- `unsupported.callbacks`
- `unsupported.securityScheme`
- `unsupported.uniqueItems`
- `unsupported.tuple`
- `unsupported.discriminator`
- `unsupported.composition`
- `unsupported.composition.conflict`
- `unsupported.composition.oneOfOverlap`
- `name.collision`

When `onUnsupported: "error"` is set, only diagnostics whose code starts with `unsupported.` are promoted to errors. Invalid input diagnostics should always be errors.

## Naming

Generated names must be deterministic:

- Component schema `User` becomes `UserSchema`.
- Component parameter `UserId` becomes `UserIdParameter`.
- Component request body `CreateUser` becomes `CreateUserRequestBody`.
- Component response `UserResponse` becomes `UserResponseResponse` unless a smarter suffix rule avoids duplicated terms with tests.
- Component header `RateLimit` becomes `RateLimitHeader`.
- Security scheme `BearerAuth` becomes `BearerAuthSecurity`.
- Operation `operationId: getUser` becomes `getUserOperation`.
- An operation without `operationId` derives from method plus path, for example `GET /users/{userId}` becomes `getUsersUserIdOperation`.
- Apply `schemaNamePrefix` before sanitization and `schemaNameSuffix` after the component name.
- Apply `operationNamePrefix` before sanitization and `operationNameSuffix` after the operation name.
- Remove or convert invalid TypeScript identifier characters.
- Prefix names that start with invalid identifier characters, for example `Schema1User`.
- Avoid TypeScript reserved words by prefixing safely.
- Resolve collisions deterministically by appending `_2`, `_3`, and so on.
- Emit `name.collision` for every generated-name collision.

Inferred type names must remove the configured schema suffix when possible:

```ts
export const UserSchema = z.object({
  id: z.string(),
});

export type User = z.infer<typeof UserSchema>;
```

If the inferred type name would collide with another generated type name, resolve it with the same deterministic suffix strategy and emit `name.collision`.

## Code Generation Rules

Generated code must be stable and readable:

- Always emit the import first.
- Add a blank line after the import.
- Emit `openApiMetadata` before validator exports when `includeDocumentMetadata` is true.
- Emit schemas in sorted component order.
- Emit each inferred type immediately after its schema.
- Emit reusable parameter, request body, response, header, and security exports after schemas and before operations.
- Emit operations in sorted path and method order.
- Emit the aggregate `routes` export after all operation exports.
- Emit operation inferred types immediately after each operation when `includeOperationTypes` is true:
  - `export type GetUserRequest = typeof getUserOperation.request;`
  - `export type GetUserResponses = typeof getUserOperation.responses;`
- Use two-space indentation.
- Use double quotes for generated string literals.
- Quote object property keys only when required by TypeScript syntax.
- Escape generated string literals with `JSON.stringify`.
- Emit `new RegExp(<json string>)` for safe OpenAPI `pattern` values.
- Avoid comments in generated output unless needed for a diagnostic placeholder.
- Use `undefined` for intentionally absent request bodies and response content rather than `null`.
- Use lowercase generated HTTP method strings.
- Preserve path template spelling in generated route metadata.
- Normalize generated HTTP header object keys to lower case.

When a schema cannot be converted but generation can continue, emit `z.unknown()` at that location and attach a diagnostic. Do not silently substitute `z.any()`.

## Test-Driven Implementation Strategy

Start with fixture pairs:

- OpenAPI input document.
- Manually authored expected TypeScript/Zod output.
- Expected diagnostics JSON.

Initial fixture coverage:

- primitive string, number, integer, boolean, and null schemas
- string formats: email, uuid, uri/url, date-time, date, and unknown format
- string, number, and array constraints
- required and optional object properties
- nullable fields in OpenAPI 3.0 and 3.1 forms
- arrays of primitives and arrays of refs
- string enums, mixed literal enums, and single-value enums
- records using `additionalProperties`
- nested objects
- local `$ref` references
- invalid and external `$ref` references
- self refs and circular refs requiring `z.lazy`
- safe `oneOf`, `anyOf`, and `allOf`
- unsafe or unsupported composition diagnostics
- unsupported keywords that must produce diagnostics
- name sanitization and name collisions
- document metadata with info, servers, tags, and externalDocs
- paths with multiple HTTP methods and deterministic operation ordering
- path-level and operation-level parameter merging and overriding
- path, query, header, and cookie parameter validators
- request bodies with required and optional JSON content
- response validators for success, error, default, and no-content responses
- response headers and reusable header components
- reusable parameters, request bodies, responses, headers, and security schemes
- global security inheritance, operation security override, and public operations
- apiKey, HTTP basic, HTTP bearer, OAuth2, and OpenID Connect security schemes
- unsupported media types, serialization options, callbacks, links, and path item refs

Milestones:

1. Loader and API shell return empty generated output for empty `components.schemas`.
2. Primitive and object fixtures pass.
3. Required, optional, nullable, and constraints pass.
4. References and circular references pass.
5. Enums, records, and composition pass.
6. Reusable parameters, headers, request bodies, and responses pass.
7. Path and operation fixtures pass with request and response validators.
8. Security scheme and security requirement fixtures pass.
9. CLI parity tests pass against the same expected generated outputs.

The library API must support tests directly by returning generated output descriptors and structured diagnostics without writing to disk. CLI tests must prove that the bytes written to disk match library output exactly.

## Testing Plan

- Fixture-first tests using manually authored expected Zod output as the source of truth.
- Unit tests for normalization edge cases after fixture behavior is established.
- Unit tests for reference graph and cycle detection.
- Unit tests for operation name generation, path sorting, method sorting, and route map ordering.
- Unit tests for parameter override behavior using `name` plus `in`.
- Unit tests for security inheritance and operation-level security override behavior.
- Fixture tests for representative OpenAPI 3.0 and 3.1 documents.
- Diagnostics tests for invalid refs, unsupported features, unsafe defaults, and warning-as-error behavior.
- Diagnostics tests for invalid paths, invalid path parameters, missing responses, unsupported media types, unsupported serialization, and invalid security requirements.
- CLI smoke test converting a small YAML spec into generated `.ts` output.
- CLI parity tests confirming written file contents match the library-generated expected outputs.
- TypeScript compile test for generated output.
- Runtime smoke test importing generated schemas and parsing representative valid and invalid values.
- Runtime smoke test validating route request containers and response content schemas for representative operations.

Use snapshots only for broad regression coverage after explicit expected fixtures exist. Core behavior should remain hand-authored and reviewable.

## Acceptance Criteria

- A minimal OpenAPI 3.0 spec with `components.schemas` converts into valid TypeScript using Zod 4.
- A minimal OpenAPI 3.1 spec using JSON Schema-style nullable values converts correctly.
- A minimal OpenAPI document with `paths` converts into operation exports and an aggregate route map.
- Document metadata is emitted when configured and skipped when disabled.
- Generated output is deterministic across repeated runs.
- Required, optional, and nullable object properties map correctly.
- Local `$ref` references produce schema symbol references.
- Local `$ref` references to reusable parameters, request bodies, responses, headers, and security schemes resolve correctly.
- Self-references and circular references use `z.lazy`.
- Path, query, header, and cookie parameters map into the correct request containers.
- Required and optional request bodies map correctly for configured media types.
- Response status codes, default responses, response bodies, and response headers map correctly.
- Global and operation-level security requirements are represented in operation metadata.
- Generated security validators validate credential locations and basic credential shapes for supported security schemes.
- Unsupported features produce stable diagnostics.
- `onUnsupported: "error"` promotes unsupported diagnostics to errors.
- CLI exits correctly for success, error, and fail-on-warning cases.
- CLI-written output matches library output for the same input and options.
- Generated TypeScript compiles under `strict` mode.

## Assumptions

- The package is TypeScript-first.
- Zod 4 is the target runtime validation library.
- TypeScript `strict` mode is expected.
- Generated TypeScript output imports from `zod`, not `zod/v4`, unless implementation constraints later require otherwise.
- Tests must prefer explicit expected files over broad auto-generated snapshots for core conversion behavior.
- The first implementation must optimize for correctness and clear behavior over broad best-effort conversion.
- `design-doc.md` lives at the repo root.
