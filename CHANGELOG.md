# Changelog

All notable changes to this project will be documented in this file.

This project follows semantic versioning. Patch releases contain compatible bug fixes, minor releases add compatible functionality, and major releases may include breaking API or generated-output changes.

## Unreleased

## 0.3.1

- Rename the published package to `@justiceo/openapi-zod` (the unscoped `openapi-zod` name on npm belongs to an unrelated, unmaintained package). The CLI bin name is unchanged (`openapi-zod`).
- Fix: multi-file output emitted `.js`-suffixed relative imports (`./schema.js`, `./operations.js`) between generated files. This resolves fine under `moduleResolution: NodeNext` but breaks bundler-mode consumers (`moduleResolution: bundler`, used by tsc/bun and by Next.js/Turbopack), which fail with "Module not found" since no `.js` file actually exists alongside the `.ts` output. Imports are now extensionless.
- Fix: `ClientResponseData<Responses>` (used by the generated client SDK) unioned the response body of every status code, so a successful `ClientResult`'s `data` was typed as `SuccessBody | ErrorBody`. It's now narrowed to 2xx responses only.

## 0.3.0

- Add an opt-in generated client SDK: `includeClient: true` (or `--include-client` on the CLI) emits `api/client.ts` (or appends to `schemas.ts` in single-file mode) with typed, per-operation fetch wrapper functions and a bound `createClient()`, built from the already-generated operation metadata. Calls return a discriminated `ClientResult<T>` instead of throwing.
- **Breaking:** move `zod` from `dependencies` to `peerDependencies` (`^4.1.12`). The converter itself never imports `zod` — only generated output does — so consumers should already have it installed; this avoids a duplicate/mismatched `zod` copy in `node_modules`.
- Guard schema conversion against pathologically deep or adversarial input: recursive descent now stops at a maximum nesting depth (emitting a diagnostic instead of crashing), `$ref` graph walks are iterative, and malformed YAML/JSON input files now raise a clear error naming the file.
- Replace per-edge `$ref` cycle detection with a single-pass strongly-connected-components algorithm, reducing cycle detection from roughly O(V·E) to O(V+E) for large component graphs.
- Add a `customFormats` option (and `--custom-format` CLI flag) to register consumer-owned functions against `format` names, with the `x-format-options` vendor extension for per-field parameters.
- Add production-readiness documentation, package metadata, CI, release automation, CLI hardening, support matrix, and expanded fixture coverage.
- Split generated output into `api/schema.ts`, `api/operations.ts`, and `api/router.ts` by default (multi-file mode); pass `outputMode: "singleFile"` or `--single-file` to keep the combined `schemas.ts` output.

## 0.1.0

- Initial converter, library API, CLI, diagnostics, and fixture-based test suite.
