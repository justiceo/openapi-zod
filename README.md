# openapi-zod

Convert OpenAPI 3.0.x and 3.1.x documents into Zod 4 validators, inferred TypeScript types, operation metadata, route maps, reusable component validators, security credential validators, and document metadata.

The package exposes a pure library API and a thin CLI. The library returns generated files in memory; the CLI owns reading OpenAPI files and writing generated TypeScript.

## Install

```sh
npm install openapi-zod zod
```

## CLI

```sh
npx openapi-zod --input openapi.yaml --output src/generated
```

JSON inputs are also supported:

```sh
npx openapi-zod --input openapi.json --output src/generated --output-file schemas.ts
```

Useful flags:

```text
--input <path>              OpenAPI YAML or JSON file. Required.
--output <dir>              Directory for generated files. Required.
--output-file <name>        Generated file name. Default: schemas.ts.
--name-prefix <value>       Prefix for component schema exports.
--name-suffix <value>       Suffix for component schema exports. Default: Schema.
--operation-prefix <value>  Prefix for operation exports.
--operation-suffix <value>  Suffix for operation exports. Default: Operation.
--no-types                  Skip inferred schema type exports.
--no-route-map              Skip the aggregate routes export.
--no-operation-types        Skip inferred operation request and response types.
--no-security-validators    Skip security credential validators.
--no-metadata               Skip document metadata export.
--strict-objects            Generate strict object schemas where possible.
--media-type <value>        Include an additional request/response media type. Repeatable.
--exclude-deprecated        Skip deprecated operations and reusable components where possible.
--fail-on-warning           Exit non-zero when warnings are emitted.
--help                      Print CLI usage.
--version                   Print package version.
```

Diagnostics are printed to stderr as:

```text
<level> <code> <path> <message>
```

The CLI exits non-zero when conversion emits errors, or when `--fail-on-warning` is used and warnings are emitted.

## Library API

```ts
import { convertOpenApiToZod } from "openapi-zod";

const result = convertOpenApiToZod(openApiDocument, {
  outputFileName: "schemas.ts",
  includeInferredTypes: true,
  includeRouteMap: true,
});

for (const output of result.outputs) {
  console.log(output.path);
  console.log(output.contents);
}

for (const diagnostic of result.diagnostics) {
  console.error(diagnostic.level, diagnostic.code, diagnostic.path, diagnostic.message);
}
```

The library does not read files, create directories, write outputs, or exit the process.

## Generated Output

Generated files import Zod 4 and export stable TypeScript declarations:

```ts
import * as z from "zod";

export const UserSchema = z.object({
  id: z.uuid(),
  email: z.email(),
  name: z.string(),
});

export type User = z.infer<typeof UserSchema>;

export const getUserOperation = {
  method: "get",
  path: "/users/{id}",
  operationId: "getUser",
  parameters: {
    path: z.object({ id: z.uuid() }),
  },
  responses: {
    200: UserSchema,
  },
} as const;

export const routes = [getUserOperation] as const;
```

Exact output depends on the OpenAPI document and selected options. Component names, reusable components, paths, and operations are sorted for deterministic generation.

## Options


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

## Support Matrix

Support levels:

| Level | Meaning |
| --- | --- |
| exact | Generated validators preserve the OpenAPI semantics closely enough for application boundary validation. |
| helper-backed | Generated validators use local helper code for behavior Zod does not provide directly. |
| metadata-only | The field is preserved in generated metadata but does not affect validation. |
| unsupported | The field is diagnosed and ignored, or replaced with `z.unknown()` when a validator is required. |

OpenAPI document surfaces:

| Surface | Support | Notes |
| --- | --- | --- |
| OpenAPI 3.0.x and 3.1.x documents | exact | `openapi` must start with `3.0.` or `3.1.`. |
| `components.schemas` | exact/helper-backed | Generates named Zod schema exports and inferred types. |
| Local schema `$ref` | exact | Local component refs are resolved to generated symbols. |
| External `$ref` | unsupported | No filesystem or network reference loading. |
| `paths` and operations | exact | Generates operation exports and optional aggregate `routes`. |
| Path/query/header/cookie parameters | exact | Validators expect already-parsed values. |
| Non-default parameter serialization | metadata-only/unsupported | Metadata may be preserved; raw wire parsing is not generated. |
| Request bodies and responses | exact | Selected media types default to `application/json`. |
| Reusable parameters, request bodies, responses, and headers | exact | Generates reusable validators where representable. |
| Security schemes | exact/metadata-only | Credential shape validators are generated; authorization is not implemented. |
| `info`, `servers`, `tags`, `externalDocs` | metadata-only | Emitted under document metadata when enabled. |
| Deprecated operations/components | exact | Included by default; can be skipped with `includeDeprecated: false`. |

JSON Schema and OpenAPI schema keywords:

| Keyword or feature | Support | Notes |
| --- | --- | --- |
| `type`, primitive strings, numbers, integers, booleans, arrays, objects | exact | Uses Zod primitives and object/array validators. |
| OpenAPI 3.0 `nullable` | exact | Emits nullable schemas. |
| OpenAPI 3.1 type arrays including `null` | exact | Emits nullable or union schemas where representable. |
| `enum`, `const` | exact | Literal-safe values are emitted deterministically. |
| `default` | exact/warning | Defaults are emitted when literal-safe and compatible enough to trust. |
| `format` for common strings | exact/unsupported | Known formats use Zod helpers; unknown formats are diagnosed. |
| String, number, array, and object bounds | exact | Uses native Zod checks where available. |
| `allOf`, `anyOf`, `oneOf` | exact/helper-backed | Uses intersections, unions, object merging, or exact-one helper depending on shape. |
| Recursive schemas | exact | Uses cycle handling where needed. |
| `propertyNames`, `patternProperties` | helper-backed | Uses generated refinements. |
| `contains`, `minContains`, `maxContains` | helper-backed | Uses generated refinements. |
| `if`, `then`, `else` | helper-backed | Supported for independently representable branches. |
| `dependentRequired`, `dependentSchemas` | helper-backed | Uses generated object refinements. |
| `unevaluatedProperties`, `unevaluatedItems` | unsupported | Requires full JSON Schema evaluation state. |
| Complex discriminator mappings | unsupported | Diagnosed when behavior cannot be represented safely. |

This package is a converter, not a complete OpenAPI validator or HTTP parser. Generated request validators operate on parsed JavaScript values, not raw query strings, path strings, headers, or cookies.

## Release Process

Releases follow semantic versioning and are recorded in `CHANGELOG.md`.

1. Update generated behavior, tests, and documentation.
2. Move relevant `CHANGELOG.md` entries from `Unreleased` to the target version.
3. Update `package.json` version.
4. Run `npm run build`, `npm test`, and `npm run pack:dry-run`.
5. Publish with provenance from the release workflow, or manually with equivalent npm provenance settings.

