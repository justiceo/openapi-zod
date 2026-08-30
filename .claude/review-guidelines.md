# Code Review Guidelines

Adapted from Google's TypeScript Style Guide, and filtered to what applies
to this codebase (Node/ESM, TypeScript, no DOM, no decorators). This is a
standalone open-source library (OpenAPI 3.x -> Zod 4 codegen), published as
an npm package with a CLI — not an application backend.

### Type system

**No nullable/undefined type aliases.** A type alias must not include `|null`
or `|undefined` in its own definition; add that at the point of use instead.
Baking absence into the alias hides where it comes from and forces every
consumer to re-check it even where the value is guaranteed present.

```typescript
// Bad
type ConvertResult = Success | Failure | undefined;
convert(): ConvertResult { ... }

// Good
type ConvertResult = Success | Failure;
convert(): ConvertResult | undefined { ... }
```

- **Prefer optional fields over `|undefined` properties**: `foo?: string`
  over `foo: string | undefined`. Initialize class fields at declaration
  where practical rather than leaving them possibly-undefined.
- **Explicit types when inference isn't obvious** from the initializer.
- **Interfaces for structural/object shapes**, not classes, when there's no
  behavior to attach — reserve `class` for things with real methods/invariants.
- **Simplest type construct wins.** Prefer a plain interface extension or
  repetitive explicit type over a clever mapped/conditional type.
- **Index signatures need a meaningful key label**
  (`{[schemaName: string]: Schema}`, not `{[key: string]: Schema}`);
  `Record<K, V>` is usually clearer when the key set is known.
- **Tuples for genuinely positional data**; named properties when a name
  would clarify which element is which.
- **Avoid return-type-only generics** — if the generic can't be inferred
  from an argument, every caller must write it out and can get it wrong
  silently.

### Coercion & comparisons

- Use `Number()` to parse, and check the result for `NaN` explicitly — don't
  trust `parseInt`/`parseFloat`/unary `+` for general numeric parsing.
- Never coerce an enum value to boolean implicitly; compare against a real
  member.
- `Math.floor(Number(x))` for integer parsing, not bit tricks.

### Classes

- Prefer module-local functions over `private static` methods — a static
  method can't be called any other way, so a plain function is simpler.
- Don't reach through visibility with bracket access (`obj['privateField']`)
  to dodge TypeScript's access checks.
- A getter must be a pure function — no observable side effects, no mutation.
  If you need a side effect, use a method instead.
- Never define accessors via `Object.defineProperty`; use `get`/`set` syntax.
- Field shape must be stable after the constructor runs — don't add or
  delete instance properties later; initialize everything (even to
  `undefined`) up front so V8's hidden-class optimizations aren't defeated.

### Functions & `this`

- Prefer function declarations for named, module-level functions; arrow
  functions for callbacks and anything that needs lexical `this`.
- Avoid `.bind(this)`; prefer an arrow function instead.
- `this` belongs only in constructors, instance methods, or arrow functions
  with an explicit lexical binding.
- Prefer small functions and use composition. Small functions are easier to
  understand, debug, test and reuse.

### Exceptions & Errors

- When catching, assume the thrown value is an `Error` instance unless an
  API is conclusively documented to throw something else.
- An empty `catch` block is almost never correct — if you really mean to
  swallow the error, add a comment explaining why.
- Exceptions should be used for truly exceptional errors.
  An expected error is not exceptional.
- Throw only `Error` or subtypes of `Error`. Do not throw primitives or objects.
- When rethrowing an error, propagate the original error through {cause}.
- A good error is informative, actionable, clear and concise.

### Try blocks

- Keep the code inside a `try` focused on the statements that can actually
  throw; move everything else outside it so failures aren't attributed to
  the wrong line.

### Comments & JSDoc

- `/** JSDoc */` for anything documenting an API surface; `//` line comments
  for implementation notes.
- JSDoc is Markdown — use real Markdown lists, not indented plain text.
- No boxed/asterisk-bordered comment blocks.
- Use a comment when it is infeasible to make your code self-explanatory.
- A good comment describes *why*, not *what* the code is doing.

### Naming

- No ambiguous abbreviations, and don't abbreviate by deleting internal
  letters (`indx` for `index`) — acronym-style abbreviation (`id`, `url`)
  is fine.
- Treat acronyms as whole words in identifiers (`schemaId`, not `schemaID`).

### Testing

- Real implementations or high-quality fakes are ALWAYS preferred
  over mock-heavy tests. Prefer running the converter end-to-end against a
  fixture OpenAPI document over unit-testing internal helpers in isolation.
- Enforce proper test file naming and location. Test files should match name
  of component being tested and be consistent with existing test structure.
- Avoid starting test descriptions with "should", describe the behavior
  directly using an active verb. `it('should return NaN')` is best stated as
  `it('returns NaN')`.
- Test behaviors, not implementations. Focus unit tests on verifying public
  API or observable output of the converter. Refrain from change-detector
  tests: if someone refactors internal logic without changing behavior, the
  tests should still pass.
- Refactor to make the system testable, don't hack it to make it testable. Do
  not override the type system, e.g. `(myInstance as any).privateMethod()` is
  an anti-pattern. Use `TEST_ONLY` exports to expose properties/logic to tests.
- Global or shared state is a common source of test flakiness. Use `beforeEach`
  to cleanly re-instantiate tests.

### Commits

- A commit should be one self-contained change, and its description should
  reflect the scope of changed files.
- Prefer small commits over large ones. They are easier to review, can be
  reviewed more thoroughly, and are less likely to introduce bugs.
- If a commit contains multiple disparate changes, suggest breaking it up into
  smaller focused commits.

### General Change-level guides

- While uncommon, certain changes may warrant updates to `README.md`; report
  this if applicable. `README.md` should be more correct and concise than
  complete.
- Be wary of adding new dependencies to minimize supply-chain risks — this is
  a published library, and every dependency becomes a transitive dependency
  of every consumer. If the dependency is minor or can be trivially inlined,
  inline it.
- Changes to the public API surface (`src/index.ts` exports, the CLI's flags
  in `src/cli.ts`) are breaking-change candidates; flag them explicitly and
  check whether they need a CHANGELOG entry.
- `.github/workflows/publish.yml` auto-publishes a patch release on every
  push to `main` that touches `src/`. If this change is a new feature
  (`feat:`) or breaking (`!`/`BREAKING CHANGE:`), flag that `version` in
  `package.json` needs a manual minor/major bump in this PR — the workflow
  only ever bumps patch on its own, and takes a `package.json` version
  already ahead of the latest tag as-is instead of adding to it.
- Review every line of the change diligently — you are the final gate of
  quality, maintainability, and security for this code.
- If, in the course of review, you identify an issue unrelated to the change
  under review, report it without blocking the commit.
