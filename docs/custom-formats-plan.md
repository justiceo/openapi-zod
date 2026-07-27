# Custom string formats

## Context

`schema.ts` already maps a fixed set of JSON Schema `format` values to Zod
built-ins (`email` → `z.email()`, `uuid` → `z.uuid()`, `uri`/`url` → `z.url()`,
`date-time` → `z.iso.datetime()`, `date` → `z.iso.date()`). Any other `format`
value hits the `unsupported.format` diagnostic and falls back to a plain
`z.string()`.

That fixed list can never cover every format a consumer's API actually needs.
Domains regularly have string formats with validation/normalization rules that
are meaningful to that API but don't belong in a general-purpose OpenAPI→Zod
converter — a phone number validated with `libphonenumber-js`, a slug checked
against a reserved-word list, a domain name normalized with `tldts`, an
internal ID checked against a known prefix, etc. Today the only way to apply
that kind of rule is to bypass the generated schema entirely: hand-write a Zod
wrapper next to the generated file that re-declares the field and layers a
`.transform()`/`.refine()` on top. That works, but it duplicates the field
declaration in two places (the spec and the wrapper), and it's easy for the
two to drift — the wrapper's `min(1, ...)`/`trim()` copy of the generated
constraint has no compiler-enforced link back to the spec.

The generator can't (and shouldn't) know what a "valid domain name" or
"valid phone number" is — that logic and its runtime dependencies (`tldts`,
`libphonenumber-js`, ...) belong to the consumer, not to this package. What
the generator *can* do generically is: let a consumer register a format name
against a function they own, and emit a call to that function inline in the
generated schema, the same way it already emits calls to its own generated
helpers for `propertyNames`, `patternProperties`, `dependentRequired`, etc.
(the existing "helper-backed" support tier). This is that mechanism, extended
to accept helpers from outside the package.

## Design

### Registering a custom format

A new `customFormats` option, alongside the other `ConvertOpenApiToZodOptions`:

```ts
export type ConvertOpenApiToZodOptions = {
  // ...
  customFormats?: Record<string, { module: string; import: string }>;
};
```

Example:

```ts
convertOpenApiToZod(document, {
  customFormats: {
    "phone-number": { module: "../../utils/phone.js", import: "phoneNumberFormat" },
  },
});
```

`module` is emitted verbatim as an import specifier, so it should already be
resolvable relative to the generated file (a relative path, or a package
name). This package does not resolve, load, or type-check it.

On the CLI, the same thing is expressed as a repeatable flag:

```
--custom-format phone-number=../../utils/phone.js#phoneNumberFormat
```

### Declaring the format in the spec

```yaml
phone:
  type: string
  format: phone-number
  x-trim: true
```

`convertString` (`src/schema.ts`) checks `customFormats[schema.format]` before
falling through to the built-in switch / `unsupported.format` diagnostic. When
it matches, the existing base-expression logic (`x-trim`, `minLength`,
`maxLength`, `pattern`) still applies — a custom format is a validation *tier*
on top of the base string schema, not a replacement for it — and the result is
piped through a call to the registered function:

```ts
z.string().trim().transform((value, ctx) => phoneNumberFormat(value, ctx))
```

The imported function owns both validation and normalization. Its shape:

```ts
(value: string, ctx: z.core.$RefinementCtx) => string
```

On invalid input it calls `ctx.addIssue(...)` and returns the input unchanged
(Zod still fails the parse because an issue was added — the return value is
only used on the success path). On valid input it returns the normalized
value, e.g. lowercased, trimmed, punycode-decoded — whatever the field's rules
require. This mirrors how the generator's own built-in formats behave: it's
just a Zod schema piece, not a new code path.

### Passing per-field options

Some formats need a field-specific parameter — e.g. a domain-name format where
one field should reject subdomains and another shouldn't, both using the same
registered function. Rather than growing the generator's vendor-extension
vocabulary with format-specific keywords, a single generic extension covers
all of them:

```yaml
domainName:
  type: string
  format: domain-name
  x-format-options: { rejectSubdomains: true }
```

`x-format-options` must be a plain JSON-safe object (or omitted). When
present, it's emitted as a literal third argument using the existing
`jsonLiteral()` helper (`src/emit.ts` — already used for enum/const/default
literals):

```ts
z.string().transform((value, ctx) => domainNameFormat(value, ctx, { rejectSubdomains: true }))
```

so the registered function's shape becomes:

```ts
(value: string, ctx: z.core.$RefinementCtx, options?: Record<string, unknown>) => string
```

The generator never inspects the *contents* of `x-format-options` — it only
serializes it. Meaning is entirely up to the consumer's function.

### Import emission

Each converted schema only knows the format name; it doesn't emit an import
itself. Conversion instead records which custom format names were actually
used (a `Set<string>` threaded through `ConvertContext`/`SharedContext`
alongside the existing `helpers: Set<HelperName>`), and after all schemas are
converted, `index.ts` walks that set once and prepends one deduplicated
`import { <import> } from "<module>";` line per module+import pair to the
relevant output file(s) (`api/schema.ts`, or `schemas.ts` in single-file mode).
This keeps `convertString` itself free of file-level concerns, consistent with
the existing helper-emission pattern.

An unresolvable/misspelled `module` path is not this package's problem to
catch — it's a normal consumer-side compile error in the generated output,
the same way a bad `$ref` to an external file already is.

### Diagnostics

If `schema.format` isn't in the built-in list *and* isn't in `customFormats`,
behavior is unchanged: `unsupported.format`, falling back to `z.string()`.
No new diagnostic codes are needed for the success path — a registered custom
format is, from the diagnostics' point of view, just as "supported" as `email`.

## Support matrix

Add a row to `README.md`'s keyword table:

| Keyword or feature | Support | Notes |
| --- | --- | --- |
| `format` for common strings | exact/unsupported | Known formats use Zod helpers; unknown formats are diagnosed. |
| `format` registered via `customFormats` | helper-backed | Emits a call to a consumer-supplied function; consumer owns validation/normalization and any runtime dependency. |

## Scope

In scope:
- `customFormats` option + `--custom-format` CLI flag.
- `convertString` support for looking up and applying a custom format.
- `x-format-options` vendor extension for per-field parameters.
- Import emission for the registered module/name pairs actually used.
- Fixture tests: a custom format with no options, one with `x-format-options`,
  and the existing `unsupported.format` diagnostic path staying unaffected for
  formats that are in neither list.

Out of scope:
- Validating that the registered module/import actually exists or exports the
  right shape — that's a downstream TypeScript compile error, not something
  this package can check without resolving the consumer's module graph.
- Any specific format (domain names, phone numbers, etc.) — this package
  ships the extension point only, never a built-in implementation of it.
- Custom formats for non-string types (`number`/`integer` `format`, e.g.
  `int32`) — today's built-in formats are all string-only tiers via
  `convertString`; extending the same mechanism to `convertNumber` would be a
  separate, later change if a real use case shows up.

## Verification

- Unit/fixture tests in `test/` covering: a custom format applied with no
  options, one with `x-format-options`, import deduplication when two fields
  share the same custom format, and confirming an unregistered format still
  produces `unsupported.format`.
- `npm run build && npm test` (existing fixture suite plus the new cases).
- A CHANGELOG.md entry under `Unreleased`.
