# Docs

Start here, then read the files in order.

| File | What it covers |
|---|---|
| [01-fp-concepts.md](./01-fp-concepts.md) | Functions as values, pure functions, closures, immutability, currying |
| [02-typescript.md](./02-typescript.md) | Type annotations, generics, constraints, `Record`, intersection types |
| [03-patterns.md](./03-patterns.md) | Module pattern, container, `compose.ts`, testing, lifetimes, ES modules |
| [04-cross-cutting.md](./04-cross-cutting.md) | Logging and metrics — interfaces, implementations, wiring, testing |
| [05-going-deeper.md](./05-going-deeper.md) | `this` binding bug, clean code structure, immutability performance |

## Quick reference

| Concept | Where it appears |
|---|---|
| Functions as values | Every module — functions are stored, passed, returned |
| Pure functions | `reserve.ts` — same input always gives same output |
| Closures | `saveReservation.ts` — private `reservations[]` array |
| Immutability | `container.ts` — each `.add()` creates a new object |
| Currying | Every module — outer takes deps, inner does work |
| Generics `<T>` | `container.ts` — tracks registered services |
| Constraints `extends` | `container.ts` — `K extends string` enforces key names |
| `Record<K, V>` | `container.ts` — represents a single added service |
| Intersection `A & B` | `container.ts` — merges old services with new |
| Module pattern | `src/modules/**` — each file is one curried function |
| Container pattern | `src/container.ts` + `src/compose.ts` — wires modules |
| DI via arguments | All modules — deps received as args, never imported directly |
| Singleton lifetime | Container — one instance per `compose()` call |
| ESM singleton | Module cache — one instance per process |
| Transient lifetime | Export a factory function from a module |
| `this` binding bug | Class methods — lost when passed as callbacks |
| No `this` bug | Functional — deps in closure, not on object |
| Clean structure | One function per file, types co-located, deps flow through compose |
| Structural sharing | Spread copies references (8 bytes), not values |
| Cross-cutting concern | `Logger`, `Metrics` — injected as deps, not imported |
| `interface` | Defines contract for multiple implementations |
| `FakeMetrics extends Metrics` | Test double that satisfies the interface + exposes inspection |
| Silent logger | Suppresses output in tests without changing business logic |
