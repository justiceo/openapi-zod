# openapi-zod: Robustness, Performance, Size & Maintainability Roadmap

## Context

`openapi-zod` (v0.1.1, pre-1.0) converts OpenAPI 3.x documents to Zod 4 validators via string-concatenation codegen (not an AST-based emitter). The codebase is small (~4k lines across `src/`) and has good type discipline (no `any` anywhere) and broad fixture-based test coverage in `test/converter.test.ts`. However, exploration surfaced concrete gaps in each of the four target areas:

- **Robustness**: several recursive functions in `src/schema.ts` (cycle detection, ref collection, schema conversion) have no depth guards, so a pathological or deeply-nested/circular OpenAPI document (untrusted input, since this is a generator that ingests arbitrary specs) can crash the process with a stack overflow instead of producing a diagnostic. Parse errors from `loader.ts` also aren't caught into the tool's existing diagnostic system.
- **Maintainability**: `src/schema.ts` (879 lines) concentrates most complexity; ref-resolution logic is duplicated 4x across `src/components.ts` for parameters/headers/requestBodies/responses; `readPackageVersion` in `cli.ts` mixes sync I/O into an otherwise async CLI.
- **Bundle size / deps**: `zod` is a hard runtime dependency even though the converter's own code never imports it (only generated *output* code and the `route-helper.ts` string template reference it) — this risks duplicate `zod` copies in consumers' `node_modules`. No lint/typecheck gate runs in CI, and there's no bundle-size measurement.
- **Performance**: cycle detection (`findCycleEdges`/`hasPath`) is roughly O(V·E) with a fresh visited-set per outer iteration — fine for typical specs, but avoidably slow for large component graphs (100s of schemas).

This plan is pre-1.0, so breaking changes are allowed (dependency shape, stricter error surfaces) as long as they're called out in `CHANGELOG.md`.

## Workstreams

### 1. Robustness: guard recursion against untrusted/pathological input
- Add a shared `MAX_DEPTH` guard (e.g. exported const in `src/core.ts`, ~ a few hundred) threaded through the recursive descent in `src/schema.ts`: `convertSchema`, `convertArray` (~357-382), `convertObject`/`applyObjectConstraints` (~423-570), and the ref-graph walkers `collectRefs`'s `visit` (~739-754) and `findCycleEdges`/`hasPath` (~717-769). On exceeding depth, emit a diagnostic (reuse `src/diagnostics.ts` shaping) instead of letting the stack overflow.
- Wrap `YAML.parse`/`JSON.parse` in `src/loader.ts` (currently unguarded, lines 9-13) in a try/catch that produces a diagnostic-shaped error consistent with the rest of the tool, instead of letting a raw parser exception bubble to the generic `main().catch` in `cli.ts`.
- Add regression tests: one fixture with a deeply nested (non-circular) schema graph past the depth guard, one with a large circular `$ref` graph, one with malformed YAML/JSON input — asserting a clean diagnostic/error rather than a crash.

### 2. Performance: cheaper cycle detection
- Replace the per-edge DFS with fresh `seen` sets in `findCycleEdges`/`hasPath` (`src/schema.ts:717-769`) with a single-pass Tarjan's SCC or iterative DFS with a global visited/onStack bookkeeping (standard cycle detection), reducing it from ~O(V·E) to O(V+E).
- Add a benchmark fixture (large synthetic component set, e.g. 200+ schemas with dense refs) exercised in a test with a soft timing assertion, so future regressions are caught the way `testTimeout: 10000` already bounds test runs.

### 3. Bundle size / dependencies
- Move `zod` from `dependencies` to `peerDependencies` (+ `devDependencies` for the test suite) in `package.json`, since `src/` never imports it — only generated output and the `route-helper.ts` template string reference it. Document the peer range (`^4.1.12`) and note this as a breaking change in `CHANGELOG.md`.
- Leave `yaml` as a runtime dependency (used by `loader.ts`, appropriately scoped).
- No bundler/minifier is needed given this is a Node CLI/library, not a browser bundle — skip introducing esbuild/tsup; the `tsc`-per-file output is fine for a library `dist/`. Confirm this stays out of scope unless the user later asks for CJS support.

### 4. Maintainability
- Deduplicate ref-resolution in `src/components.ts`: merge the two near-identical functions handling parameters/headers/requestBodies/responses (~426-472) into a single parameterized helper (already partially done via a `kind` param — finish collapsing to one function), reusing the pattern already established by `convertRef` in `src/schema.ts:680-715` where sensible.
- Split `src/schema.ts` (879 lines) along its natural seams: keep primitive/string conversion, object/array conversion, and ref/cycle-graph utilities as separate files (e.g. `schema/primitives.ts`, `schema/object.ts`, `schema/refs.ts`) re-exported from `schema.ts`, so no public import path changes. This is optional/lower-priority — only pursue if time allows after 1-3, since it's pure internal reorganization with no user-facing benefit besides easier future maintenance.
- Fix the sync/async I/O mismatch: change `readPackageVersion` (`cli.ts:63-69`) to use `readFile` (async) consistent with the rest of `cli.ts`.
- Add CI gate: wire the existing (but unused) `npm run typecheck` script into `.github/workflows/ci.yml` as a separate step so type errors are caught explicitly rather than incidentally via `npm run build`. (No linter exists yet — introducing one, e.g. ESLint/Biome, is a larger, separate decision; flag it to the user as a follow-up rather than bundling it here.)
- Add missing unit tests for `src/components.ts` (currently only exercised indirectly via fixtures) covering diagnostics/edge cases for parameter/header/requestBody/response/securityScheme conversion in `test/internal.test.ts`.

## Sequencing

1. Robustness guards + loader error handling + regression tests (highest risk: crashes on untrusted input).
2. Dedup `components.ts` ref logic + async `cli.ts` fix + CI typecheck gate (cheap, high maintainability payoff).
3. `zod` → peerDependency (breaking change, needs CHANGELOG entry and README update).
4. Cycle-detection algorithm swap + benchmark fixture (performance).
5. Optional `schema.ts` file split (maintainability, do last since it's pure reorg and highest merge-conflict risk).

## Verification

- `npm run typecheck` and `npm test` (vitest) after each workstream — existing fixture suite in `test/converter.test.ts` must continue passing unchanged (it's the main regression guard for generated-output correctness).
- For the new depth-guard/malformed-input tests, verify they fail before the fix (crash/unhandled throw) and pass after (clean diagnostic).
- For the `zod` peerDependency change, run `npm pack --dry-run` (existing `pack:dry-run` script) and manually install the packed tarball in a scratch project to confirm generated code still resolves `zod` correctly when the consumer provides it.
- For the cycle-detection rewrite, run the existing `test/fixtures/refs`/circular fixtures plus the new large-graph benchmark fixture to confirm both correctness (same diagnostics as before) and improved timing.
