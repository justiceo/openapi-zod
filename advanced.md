# Advanced Implementation Plan

This document turns the advanced gaps from `design-doc.md` into an implementation plan. The goal is not to accept every OpenAPI or JSON Schema feature. The goal is to make the converter complete enough for application boundary validation while keeping unsupported, lossy, or adapter-specific behavior explicit and test-covered.

The default stance should be conservative:

- Generate exact Zod validators when Zod can represent the OpenAPI semantics directly.
- Generate small local helpers when exact behavior is important, deterministic, and broadly useful.
- Emit diagnostics and fall back to `z.unknown()` or metadata when exact behavior would require a large runtime parser or a policy decision.
- Leave transport parsing, authorization, framework binding, and non-local reference loading to users or downstream adapters unless an explicit option is added later.

## Implementation Boundaries

The converter has three distinct responsibilities:

1. Normalize OpenAPI 3.0 and 3.1 inputs into a version-aware internal model.
2. Generate value-level Zod validators and route metadata from that model.
3. Report stable diagnostics whenever conversion is invalid, unsupported, ambiguous, or intentionally approximate.

It should not become:

- a complete OpenAPI validator;
- a JSON Schema 2020-12 implementation;
- an HTTP parser for every serialization style;
- a client/server/framework generator;
- an authorization engine;
- an external `$ref` loader.

This boundary matters most for advanced features. Several OpenAPI fields describe how bytes are parsed from HTTP, how metadata should be displayed, or how external tooling should behave. Those fields should be preserved as metadata or diagnosed, not silently folded into value validators.

## Architecture Work First

Before adding individual advanced keywords, split the current converter into explicit phases. This keeps feature additions from becoming scattered conditionals inside schema generation.

Recommended internal modules:

- `normalizer.ts`: version detection, 3.0 vs 3.1 keyword normalization, nullable handling, exclusive min/max handling, and `$ref` sibling policy.
- `refs.ts`: local reference parsing, pointer escaping, dependency graph construction, cycle detection, and component-kind-aware resolution.
- `schema.ts`: schema-to-Zod expression conversion, composition classification, literal/default handling, and helper requirements.
- `components.ts`: reusable parameters, headers, request bodies, responses, and security schemes.
- `operations.ts`: path traversal, parameter override rules, request/response containers, security inheritance, and operation naming.
- `helpers.ts`: tracks which generated helper functions are needed and emits them once per file.
- `generator.ts`: stable TypeScript rendering, indentation, symbol ordering, and metadata rendering.

Keep the public API unchanged until a feature needs a user-facing decision. Internal options can exist, but new public options should be added only when two reasonable behaviors are both safe and users genuinely need to choose.

## Internal Representation

Introduce a small intermediate representation instead of passing raw OpenAPI objects everywhere.

Useful IR shapes:

- `SchemaNode`: raw schema plus `version`, `path`, `refContext`, `nullableState`, and `unsupportedKeywords`.
- `ZodExpr`: generated expression string plus helper requirements, referenced symbols, diagnostics, and semantic notes.
- `ComponentRef`: `{ kind, name, pointer, symbolName }`.
- `OperationModel`: method, path, operation id, parameters, body, responses, security, and metadata.
- `ParameterModel`: name, location, required, value schema, serialization metadata, and source path.

The IR should not be large or framework-like. It exists to make semantics explicit before rendering TypeScript. In particular, composition and parameter serialization need classification before code generation.

## Feature Policy

Use four support levels in docs, diagnostics, and tests:

- `exact`: generated validator preserves the OpenAPI semantics closely enough for boundary validation.
- `helper`: generated validator is exact because a local helper enforces behavior that Zod does not provide directly.
- `metadata-only`: field is preserved for downstream use but does not affect validation.
- `unsupported`: field is diagnosed and ignored, or replaced by `z.unknown()` when a validator is required.

Document every advanced keyword with one of these levels. Avoid "best effort" as a support category because it hides behavior users rely on.

## Composition

Composition should be implemented by classification, not by blindly mapping keywords to `z.union` or `z.intersection`.

Implementation plan:

1. Convert each branch independently into a `ZodExpr`.
2. Classify `allOf`, `anyOf`, and `oneOf` before rendering the final expression.
3. Prefer object merge only for compatible object branches.
4. Use `z.intersection` for independently supported non-object `allOf` branches.
5. Use `z.union` for `anyOf` where at-least-one semantics are acceptable.
6. Use a generated exact-one helper for `oneOf` when overlap cannot be ruled out but each branch can be evaluated.
7. Use `z.discriminatedUnion` only for simple, fully understood discriminator cases; otherwise diagnose `unsupported.discriminator`.

Draw the line here:

- Safe object `allOf` merge is supported when properties do not conflict, `required` lists are compatible, and `additionalProperties` behavior is not made weaker.
- `oneOf` exactness should not be approximated with plain `z.union` unless branches are provably disjoint by literals, enum values, primitive types, or discriminator values.
- Complex discriminator mappings, inline branches without stable discriminator values, and ambiguous `$ref` mappings should remain unsupported until fixture coverage is broad.

Document:

- the disjointness rules for `oneOf`;
- the conflict rules for `allOf`;
- when `z.union`, `z.intersection`, `z.discriminatedUnion`, or a helper is emitted;
- the diagnostics users should expect when composition is intentionally refused.

## Advanced JSON Schema Keywords

Add support only where behavior is implementable without becoming a full JSON Schema evaluator.

Recommended stance by keyword:

| Keyword | Support level | Plan |
| --- | --- | --- |
| `minProperties`, `maxProperties` | exact | Use object refinements or Zod object size checks if available. |
| `propertyNames` | helper | Generate a key-validation helper using the converted key schema. |
| `patternProperties` | helper | Validate matching keys with generated regex/value-schema pairs in `superRefine`. |
| `dependentRequired` | helper | Generate cross-property checks in `superRefine`. |
| `dependentSchemas` | helper | Validate dependent subschemas against the full object. |
| `contains`, `minContains`, `maxContains` | helper | Count matching array items with `safeParse`. |
| `prefixItems` plus `items` | exact/helper | Use tuple schemas for fixed positions; add rest validation when representable. |
| `unevaluatedProperties` | unsupported | Requires evaluation-state tracking across composition. |
| `unevaluatedItems` | unsupported | Same evaluation-state problem as properties. |
| `if`, `then`, `else` | helper | Support only when each branch is independently supported and emit a clear helper. |

Regex behavior needs a policy. OpenAPI/JSON Schema patterns are not guaranteed to be JavaScript-compatible. Continue emitting `new RegExp(...)` only when construction is safe. Invalid or incompatible patterns should produce `invalid.schema` or `unsupported.keyword` at the keyword path.

Document:

- that this is not full JSON Schema 2020-12 evaluation;
- which keywords are exact, helper-backed, metadata-only, or unsupported;
- that helper-backed schemas rely on runtime `safeParse` checks and may produce less granular Zod errors than native Zod primitives.

## Parameter Serialization

Keep value validation separate from wire parsing.

The current route exports validate already-parsed values. Full OpenAPI serialization describes how raw HTTP path, query, header, and cookie strings become those values. That behavior belongs in an adapter layer unless the generated output explicitly includes parser functions.

Implementation plan:

1. Preserve serialization metadata on each parameter: `style`, `explode`, `allowReserved`, `allowEmptyValue`, and `schema` shape.
2. Continue emitting value-level request containers as the default.
3. Add optional generated parse metadata before generated parser functions.
4. Support only the common defaults in validators without diagnostics.
5. Emit `unsupported.parameterSerialization` for non-default styles until parser support exists.

Draw the line here:

- Do not silently validate a raw query string as if it were a parsed object.
- Do not generate framework-specific parsing code.
- Do not support ambiguous raw input behavior without fixtures for valid and invalid examples.

A later public option could be:

```ts
parameterParsing?: "metadata" | "helpers";
```

Default should be `"metadata"` if this option is added. Parser helpers should be opt-in because they define HTTP decoding behavior that many users already get from their framework.

Document:

- generated request validators expect parsed values;
- serialization metadata is available for adapters;
- unsupported styles are diagnosed unless parser helpers are enabled and covered.

## Metadata

Metadata should be deterministic and serializable. It should not affect validation unless explicitly described as parser behavior.

Implementation plan:

1. Expand metadata extraction for descriptions, summaries, examples, `externalDocs`, deprecation flags, server variables, OAuth2 flows, OpenID Connect URLs, response descriptions, and selected component metadata.
2. Keep vendor extensions omitted by default.
3. Add a future option only if needed:

```ts
vendorExtensions?: "omit" | "metadata";
```

4. If preserving vendor extensions, include only JSON-literal-safe values and sort keys.

Draw the line here:

- Examples and defaults are not the same. Defaults may affect validators with `.default(...)`; examples are metadata and should not affect parsing.
- OAuth2 scopes and URLs are metadata plus diagnostics; generated validators only validate credential shape.
- Server variables are metadata, not URL validators.

Document:

- exactly which metadata fields are emitted;
- that metadata values are sorted and JSON-literal-safe;
- that vendor extensions are omitted unless the future option enables them.

## Reference Graphs

Move reference handling to a component-kind-aware graph layer.

Implementation plan:

1. Parse local `$ref` pointers into `{ kind, name }`.
2. Build separate dependency graphs for schemas, parameters, headers, request bodies, responses, security schemes, and operations.
3. Track inline schemas reachable from non-schema components and operations.
4. Detect cycles before rendering.
5. Use `z.lazy` only where a schema cycle is actually present.
6. Attach diagnostics at the reference use site.

Draw the line here:

- Support local refs for documented component kinds.
- Keep external refs unsupported in this package until a loader API is designed.
- Do not fetch network references from the library or CLI.

If external refs are added later, expose them through a user-supplied resolver, not implicit filesystem or network behavior in the converter.

## Defaults, Literals, and Assignability

Literal emission must stay safe and deterministic.

Implementation plan:

1. Keep a JSON-literal serializer for enum, const, default, examples, and metadata.
2. Add a lightweight compatibility checker for primitive schemas, nullable schemas, arrays, objects with required properties, enums, and const.
3. Emit `.default(...)` only when the value is literal-safe and compatible enough to trust.
4. Emit `unsafe.default` when compatibility is false or unknown.
5. Emit `unsafe.literal` for values that cannot be represented as stable TypeScript literals.

Draw the line here:

- Do not attempt complete validation of defaults against arbitrary composed schemas in the first advanced pass.
- Treat uncertain assignability as a warning and omit `.default(...)` rather than generating a misleading validator.

Document:

- which schema forms are checked for default compatibility;
- when defaults are omitted;
- that examples are never used as defaults.

## OpenAPI 3.0 vs 3.1

Version differences should be handled in normalization and diagnosed when users mix forms.

Implementation plan:

1. Determine `openapi` version once and pass a `SchemaDialect` through all schema conversion.
2. Normalize supported 3.0 forms: `nullable`, boolean exclusive bounds, and OpenAPI-specific `$ref` sibling policy.
3. Normalize supported 3.1 forms: `type` arrays, numeric exclusive bounds, `const`, and selected JSON Schema 2020-12 keywords.
4. Diagnose version-incompatible forms instead of accepting both variants everywhere.

Draw the line here:

- 3.0 `nullable: true` without a concrete schema type remains `ambiguous.type`.
- 3.1 `nullable` should be diagnosed as unsupported or invalid unless intentionally allowed as a compatibility extension.
- `$ref` siblings remain unsupported except the documented 3.0 nullable case.

Document:

- a table of version-specific keyword handling;
- diagnostics for mixed-version forms;
- the exact nullable output ordering, especially for optional object properties.

## Runtime Helpers

Several advanced features need generated helpers. Use a helper registry so helpers are emitted once, before schemas, with stable names.

Helper policy:

- Helpers must be pure functions in the generated file.
- Helper names must be stable and collision-safe.
- Helpers must compile under TypeScript `strict`.
- Helpers must not add runtime dependencies beyond Zod.
- Helpers must be used only when they preserve semantics better than native Zod.
- Helpers must have runtime smoke tests, not only string fixture tests.

Initial helpers:

- `__openapiZodOneOf`: validates exactly one branch.
- `__openapiZodDeepEqual` or `__openapiZodStableJson`: supports deep `uniqueItems`.
- `__openapiZodPatternProperties`: validates regex-selected object values.
- `__openapiZodPropertyNames`: validates object keys.
- `__openapiZodContains`: validates array contains counts.
- `__openapiZodDependentRequired`: validates cross-property requirements.

Draw the line here:

- Keep helpers small and boring.
- Prefer a few general helpers over generating large custom functions per schema.
- If a helper needs to reimplement a large part of JSON Schema evaluation, leave the feature unsupported.

## CLI and Options

The CLI should remain thin. Advanced support should mostly appear in library behavior and fixtures.

Implementation plan:

1. Add tests for every existing CLI flag before adding new flags.
2. Keep file loading, output writing, diagnostic printing, and exit code behavior in the CLI.
3. Keep conversion decisions in the library.
4. Add new flags only for public options that are stable and documented.

Potential future public options:

```ts
parameterParsing?: "metadata" | "helpers";
vendorExtensions?: "omit" | "metadata";
jsonSchemaKeywords?: "conservative" | "helper";
```

Do not add these until the default behavior and diagnostics are already fixture-covered.

## Testing Plan

Advanced features need both generated-output fixtures and runtime behavior tests.

Add fixture groups in this order:

1. `versions`: OpenAPI 3.0 and 3.1 nullable, exclusive bounds, type arrays, and incompatible forms.
2. `composition-advanced`: overlapping `oneOf`, exact-one helper, object `allOf` conflicts, safe intersections, and discriminators.
3. `json-schema-advanced`: supported helper-backed keywords and unsupported evaluation-state keywords.
4. `serialization`: default parameter serialization, unsupported styles, and preserved parse metadata.
5. `metadata-advanced`: examples, descriptions, external docs, OAuth2 flows, server variables, and omitted vendor extensions.
6. `defaults`: compatible defaults, incompatible defaults, unsafe literals, enum and const edge cases.
7. `graphs`: cross-component refs, non-schema refs, cycles, invalid refs, and deterministic ordering.

For each fixture, include:

- `openapi.yaml`;
- `expected.ts`;
- `diagnostics.json`;
- runtime valid/invalid examples when helpers are involved.

Add test types:

- TypeScript compile tests for every advanced fixture.
- Runtime `safeParse` tests for helper-backed validators.
- Determinism tests that run conversion repeatedly and compare bytes.
- CLI parity tests for flags and diagnostics.

## Documentation Updates

Update user-facing docs alongside implementation. The docs should make policy decisions visible rather than listing only syntax mappings.

Document these stances clearly:

- Generated validators validate parsed values, not raw HTTP wire strings.
- Security validators validate credential shape and location, not authorization.
- Metadata is emitted for adapters and humans; it does not change parsing.
- Unsupported features produce diagnostics and are never silently approximated.
- External refs are unsupported unless a future resolver API is added.
- The converter is conservative about defaults and composition because false confidence at API boundaries is worse than an explicit warning.

Add support tables for:

- OpenAPI document surfaces;
- JSON Schema keywords;
- parameter serialization styles;
- security schemes;
- helper-backed features;
- known unsupported features.

## Milestones

1. Refactor into normalization, refs, schema, operations, helpers, and generation modules without behavior changes.
2. Add version-aware schema context and fixtures for OpenAPI 3.0 vs 3.1 differences.
3. Add component-kind-aware reference graphs and operation reachability.
4. Add helper registry and one runtime-tested helper.
5. Implement exact/default-safe composition classification.
6. Implement helper-backed `oneOf` exactness and deep `uniqueItems`.
7. Implement selected JSON Schema advanced keywords with helpers.
8. Expand metadata generation without changing validation semantics.
9. Add serialization metadata and keep parser helpers as a documented future option unless explicitly implemented.
10. Harden CLI option tests and fail-on-warning behavior.

## Completion Standard

Call the advanced parser complete when:

- every supported feature is exact or helper-backed;
- every unsupported or metadata-only feature has a stable diagnostic or documented omission;
- generated TypeScript compiles under `strict`;
- helper-backed validators have runtime valid/invalid tests;
- OpenAPI 3.0 and 3.1 differences are fixture-covered;
- CLI output matches library output for the same inputs and options;
- no advanced feature relies on silent approximation.
