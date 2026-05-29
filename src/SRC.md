# Source Layout

This package keeps its public API small while splitting converter internals by
capability. Most modules emit TypeScript source as strings; the split is about
ownership and testability, not a change in generation strategy.

## Public Entry

- `index.ts`
  - Public package entrypoint.
  - Exports the public option/result types and `convertOpenApiToZod`.
  - Owns high-level orchestration: resolve options, validate document shape,
    build names, convert component schemas, convert reusable components,
    convert operations, insert helper source, and return generated outputs.
  - Keep this file free of detailed OpenAPI or schema conversion logic.

## Internal Modules

- `core.ts`
  - Shared internal types, constants, and simple option/document helpers.
  - Defines converter contexts, resolved options, helper names, schema dialects,
    HTTP methods, reusable component result types, and OpenAPI version helpers.
  - Should stay lightweight and avoid domain conversion logic.

- `schema.ts`
  - Converts OpenAPI/JSON Schema schema objects into Zod expressions.
  - Handles primitive types, objects, arrays, enums, composition, `$ref`, cycles,
    defaults, conditional keywords, and schema diagnostics.
  - Export only schema-level entrypoints needed elsewhere, such as
    `convertSchema`, `findCycleEdges`, and `componentHasCycle`.

- `components.ts`
  - Converts reusable OpenAPI `components` entries and reusable building blocks.
  - Handles parameters, headers, request bodies, responses, security schemes,
    reusable `$ref` resolution, media type selection, and serialization
    diagnostics.
  - Operations import from here when they need parameter/body/response behavior.

- `operations.ts`
  - Converts `paths` and operations into exported operation metadata.
  - Handles operation names, request aggregation, response maps, path parameter
    validation, security requirement validation, OAuth scope checks, and response
    status ordering.

- `route-helper.ts`
  - Contains the generated route matcher/runtime helper source.
  - This is intentionally isolated because it is emitted into generated output,
    not executed by the converter itself.
  - Avoid adding OpenAPI parsing or schema conversion here.

- `emit.ts`
  - Shared source-emission toolbox.
  - Owns formatting helpers, literal/object/array expression builders, generated
    helper source, identifier sanitization, name collision handling, property key
    quoting, JSON literals, pointer escaping, regexp emission, and generic guards.
  - Keep domain decisions out of this module.

- `diagnostics.ts`
  - Diagnostic shaping and warning/error policy.
  - Used by converter modules when reporting invalid, ambiguous, or unsupported
    OpenAPI input.

- `loader.ts`
  - Loads OpenAPI YAML/JSON documents from disk.
  - Used by the CLI and tests, not by the core converter API.

- `cli.ts`
  - Command-line interface.
  - Parses flags, loads documents, calls `convertOpenApiToZod`, writes outputs,
    and reports diagnostics.

## Dependency Direction

Preferred import flow:

- `index.ts` may import any converter module.
- `schema.ts`, `components.ts`, and `operations.ts` may import from `core.ts`,
  `emit.ts`, and `diagnostics.ts`.
- `components.ts` may import `schema.ts`.
- `operations.ts` may import `components.ts`.
- `route-helper.ts` should remain standalone.
- `core.ts` and `emit.ts` should not import feature modules.

Avoid circular imports. If a helper is needed by multiple features, put generic
formatting/name/literal behavior in `emit.ts`, and shared types or simple
converter state in `core.ts`.

## Where To Add Things

- New schema keyword support: `schema.ts`.
- New reusable component behavior: `components.ts`.
- New operation/path/request/response metadata behavior: `operations.ts`.
- Changes to generated route matching/runtime validation: `route-helper.ts`.
- New formatting, naming, literal, or pointer helper: `emit.ts`.
- New public option or result shape: `index.ts` plus shared support in `core.ts`.
- New CLI flag: `cli.ts`, then wire through public options if needed.

Generated fixture output should remain byte-for-byte stable unless the change is
intentionally behavioral.
