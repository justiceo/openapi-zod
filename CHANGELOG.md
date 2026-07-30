# Changelog

All notable changes to this project will be documented in this file.

This project follows semantic versioning. Patch releases contain compatible bug fixes, minor releases add compatible functionality, and major releases may include breaking API or generated-output changes.

## Unreleased

- **Breaking:** move `zod` from `dependencies` to `peerDependencies` (`^4.1.12`). The converter itself never imports `zod` — only generated output does — so consumers should already have it installed; this avoids a duplicate/mismatched `zod` copy in `node_modules`.
- Guard schema conversion against pathologically deep or adversarial input: recursive descent now stops at a maximum nesting depth (emitting a diagnostic instead of crashing), `$ref` graph walks are iterative, and malformed YAML/JSON input files now raise a clear error naming the file.
- Replace per-edge `$ref` cycle detection with a single-pass strongly-connected-components algorithm, reducing cycle detection from roughly O(V·E) to O(V+E) for large component graphs.
- Add a `customFormats` option (and `--custom-format` CLI flag) to register consumer-owned functions against `format` names, with the `x-format-options` vendor extension for per-field parameters.
- Add production-readiness documentation, package metadata, CI, release automation, CLI hardening, support matrix, and expanded fixture coverage.
- Split generated output into `api/schema.ts`, `api/operations.ts`, and `api/router.ts` by default (multi-file mode); pass `outputMode: "singleFile"` or `--single-file` to keep the combined `schemas.ts` output.

## 0.1.0

- Initial converter, library API, CLI, diagnostics, and fixture-based test suite.
