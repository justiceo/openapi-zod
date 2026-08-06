# Generate a client SDK from the OpenAPI schema

## Context

`openapi-zod` already converts OpenAPI documents into Zod schemas (`api/schema.ts`), per-operation metadata objects (`api/operations.ts`: method, path, request param/body schemas, response schemas by status), and a **server-side** route matcher (`api/router.ts`, via `src/route-helper.ts`) that validates *incoming* requests against those operations. There is no way to make *outbound* requests to the API the document describes — consumers currently have to hand-write fetch calls and re-derive URL/query/body construction themselves, even though all the necessary metadata (`operation.request`, `operation.responses`, per-parameter `serialization` style/explode info) is already generated.

This adds an opt-in fourth generated artifact, `api/client.ts`: typed functions (and a bound `createClient()` object) that build the request from the operation's already-generated schemas, call `fetch`, and validate the response against the matching status's Zod schema. It reuses the existing operation objects at runtime (imports `getUserOperation` etc. from `operations.ts`) rather than emitting new per-operation metadata, mirroring how `router.ts` already reuses them.

## Design

- **New option** `includeClient?: boolean` in `ConvertOpenApiToZodOptions`/`ResolvedOptions` (`src/core.ts`), default **`false`** (opt-in, unlike `includeRouteMap`'s `true`, since this is a new, less battle-tested surface). New CLI flag `--include-client` in `src/cli.ts` (usage text + `parseArgs` + forwarding into `convertOpenApiToZod`).
- **New file `src/client-helper.ts`**, mirroring `src/route-helper.ts`'s pattern (`clientHelperCode(): string[]` returning literal TS source lines, not executed by the converter itself). Provides the shared runtime:
  - `ClientResult<T>` — discriminated result (`{ success: true, status, response, data }` / `{ success: false, status, response, data, issues? }`) rather than throwing, consistent with `route-helper.ts`'s `RouteMatchResult` pattern.
  - `ClientConfig` (`baseUrl`, optional `fetch` override, default `headers`, `bearerToken`) and per-call `ClientOptions` (headers/signal/bearerToken override).
  - `clientBuildUrl` — substitutes `{param}` path templates and serializes query params via `URLSearchParams`, honoring each param's `serialization` (`style`/`explode`) metadata already emitted by `operations.ts`/`components.ts` (form/explode-by-default, comma-joined when `explode: false`).
  - Header/cookie attachment, bearer-token resolution (string or sync/async getter), JSON body serialization.
  - `clientMatchResponse` — matches the actual `response.status` against the operation's `responses` keys: exact numeric status → `"NXX"` range → `"default"`, reusing the same status-key shapes `operations.ts`'s `isResponseStatus`/`responseStatusCompare` already validate.
  - `clientRequest<T>(config, operation, input, options)` — orchestrates the above and `safeParse`s the response body against the matched schema.
- **New file `src/client.ts`** (`convertClientFunctions(operations: OperationsResult, shared): { lines: string[] }`), analogous to `convertOperations`: for each operation export a thin async wrapper function (`getUser(config, input, options)`) typed from `typeof xOperation.request`/`.responses`, plus a single `createClient(config)` at the end that returns an object of bound methods (`client.getUser(input, options)`) — chosen over a first-arg-`client` calling convention for ergonomics/precedent (`fetch`-wrapper SDKs commonly do this).
- **Wiring in `src/index.ts`**: behind `resolved.includeClient`, append `client.ts`'s lines + `clientHelperCode()` in `singleFile` mode (same append pattern as `routeHelperCode()`), and add a fourth `api/client.ts` output file in `multiFile` mode that imports the needed operation objects from `./operations.js` and `clientRequest`/types from `./client-helper.js`.
- Runtime reuses `operation.request`/`operation.responses` directly — **no new per-operation metadata** needs to be emitted in `operations.ts`.

## Implementation steps

1. `src/core.ts`: add `includeClient` to `ConvertOpenApiToZodOptions`, `ResolvedOptions`, and `resolveOptions()` (default `false`).
2. `src/client-helper.ts` (new): implement `clientHelperCode()` per the design above.
3. `src/client.ts` (new): implement `convertClientFunctions()`, using existing `src/emit.ts` helpers (`objectExpression`, `sanitizeIdentifier`, `capitalize`, etc.) for consistency with `src/operations.ts`'s emission style.
4. `src/index.ts`: import both new modules; in the `singleFile` branch append client lines + `clientHelperCode()` when `resolved.includeClient`; in the `multiFile` branch add the `api/client.ts` output (with `import * as z from "zod"`, an import of the needed `xOperation` names from `./operations.js`, and an import of `clientRequest`/`ClientConfig`/`ClientOptions`/`ClientResult` from `./client-helper.js`).
5. `src/cli.ts`: add `--include-client` flag, usage text line, and forward `includeClient: cliOptions.includeClient` into `convertOpenApiToZod`.
6. `scripts/generate-fixtures.mjs`: add a second conversion pass with `includeClient: true` for fixtures that have paths (e.g. `operations`, `petstore`), writing `expected-client.ts` when `api/client.ts` is present in the output.
7. `test/converter.test.ts`: add fixture assertions for `api/client.ts` on the `includeClient: true` pass (only for fixtures with `expected-client.ts`), a CLI flag test, and a runtime end-to-end test (mock global `fetch`, call a generated `getUser`/`updateUser`-style client function, assert URL/query/headers/body construction and response parsing/validation-failure behavior) — likely a new `test/client.test.ts` or an addition to `test/internal.test.ts`.
8. `README.md`: document `includeClient`/`--include-client`, add an `api/client.ts` example to the Generated Output section, add a Support Matrix row.
9. `CHANGELOG.md`: add an `Unreleased` entry.
10. Regenerate fixtures (`npm run generate:fixtures`) and run `npm run typecheck && npm test`.

## Open design calls made (flagging, with the choice taken)

- Client validates nothing based on `operation.security` beyond attaching a bearer token if `security` is non-empty and a token is configured — it does not gate/refuse requests based on scheme shape.
- Non-JSON / multi-media-type request bodies: first version only serializes `application/json` bodies (`JSON.stringify` + `content-type: application/json`); operations whose request body only defines other media types get a client function that still compiles (body typed as `unknown`) but isn't specially serialized — can be revisited later without breaking the `ClientResult`/`ClientConfig` contract.
- No `unwrap()`/throw-mode convenience wrapper in v1 — `ClientResult<T>` discriminated return only, to keep the surface small; can be layered on later without changing generated code.

## Verification

- `npm run typecheck` and `npm test` (vitest) — full existing fixture suite must stay green since `includeClient` defaults to `false` and touches no existing output paths.
- New fixture snapshot(s) for `api/client.ts` on `operations`/`petstore` under `includeClient: true`.
- New runtime test mocking `fetch` to prove the *emitted* client code (not just its string output) correctly builds URLs/query/headers/body and parses/validates responses, including a non-2xx/`default` response case and a schema-mismatch case.
- Manually run `npx tsc --noEmit` against a temp directory containing real generated `api/*.ts` output for one fixture (there is likely already a similar "compiles" check in `test/converter.test.ts` worth extending — confirm during implementation) to catch generated-code type errors that string-snapshot tests alone wouldn't.
