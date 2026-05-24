# Docs

Start here, then read the files in order.

| File                                                 | What it covers                                                        |
| ---------------------------------------------------- | --------------------------------------------------------------------- |
| [01-fp-concepts.md](./01-fp-concepts.md)             | Functions as values, pure functions, closures, immutability, currying |
| [02-typescript.md](./02-typescript.md)               | Type annotations, generics, `Record`, object shorthand, destructuring |
| [03-patterns.md](./03-patterns.md)                   | The `make*` pattern, `compose.ts`, testing strategy, ES modules       |
| [04-cross-cutting.md](./04-cross-cutting.md)         | Logging and metrics — interfaces, implementations, wiring, testing    |
| [05-going-deeper.md](./05-going-deeper.md)           | `this` binding, immutability performance, clean code structure        |
| [06-dynamodb.md](./06-dynamodb.md)                   | DynamoDB + LocalStack — async DB interface, env-based switching       |
| [07-design-principles.md](./07-design-principles.md) | All 14 design principles applied in this codebase                     |
| [08-tsconfig-modules.md](./08-tsconfig-modules.md)   | Module resolution — `nodenext` vs `bundler`, when to use each         |
| [09-production-build.md](./09-production-build.md)   | Native Node.js execution, optional tsup build, debugging, CI sequence |

---

## Quick reference

| Concept                        | Where it appears                                                                            |
| ------------------------------ | ------------------------------------------------------------------------------------------- |
| `make*(deps)` factory pattern  | Every module — outer takes deps, inner does work                                            |
| Dependency Inversion Principle | `DB` interface in `domain/restaurant/types.ts`, implemented in `adapters/db/`               |
| Ports and adapters             | `DB`, `Restaurant`, `Logger`, `Metrics` are ports; everything in `adapters/` satisfies them |
| Inward dependency rule         | `adapters/` depends on `domain/` — never the other way                                      |
| Composition roots              | `src/server/compose.ts`, `src/cli/compose.ts` — one per entry point                         |
| Functional DI                  | `makeReserve({ db, logger, metrics })` — deps as parameters                                 |
| Stubs vs mocks                 | Stubs: plain objects; mocks: `vi.fn()` only when asserting on calls                         |
| AAA test pattern               | Every test — Arrange / Act / Assert, no shared `beforeEach` state                           |
| Barrel files                   | `src/core/index.ts` — single public barrel; re-exports all domain + port types              |
| Async at the boundary          | `DB` interface is always async even for in-memory                                           |
| Test infrastructure            | `tests/helpers/` — not in `src/`                                                            |
| Source maps                    | `tsup.config.ts` `sourcemap: true` + `node --enable-source-maps`                            |
| Module resolution              | `moduleResolution: "nodenext"` — correct for native Node.js ESM                             |
