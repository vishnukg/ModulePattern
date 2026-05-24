# The Factory Function Pattern

The pattern this project uses has a formal name. Understanding it helps you
read unfamiliar code faster and reason about trade-offs clearly.

---

## What the pattern is called

The code in this repo follows the **Factory Function with Closure-Based
Dependency Injection** pattern. You will also see it called:

- **Functional Dependency Injection** (emphasises the FP origin)
- **Module Factory Pattern** (emphasises the module boundary it creates)
- **Closure-Based DI** (shorthand among practitioners)

It is a deliberate evolution of the older **Revealing Module Pattern** —
same closure idea, but reusable: you can call the factory many times to get
independent instances.

The `class` keyword does not appear in this project. This is not an accident.

---

## The two-call shape

Every factory in this project has the same structure:

```
make*(dependencies)  →  { operation }
                              ↓
                        operation(runtimeArgs)  →  result
```

The factory is called **once** at startup (wiring time) to capture
dependencies in a closure. The returned operation is called **many times**
at runtime, once per request or event.

```ts
// Wiring time — called once in compose.ts
const { reserve } = makeReserve({ db, restaurantCfg, logger, metrics });

// Runtime — called once per HTTP request
await reserve({ quantity: 2, date: "2024-12-01" });
```

This separates two very different concerns:

| Phase | When | Who calls it |
|---|---|---|
| Construction | Startup | `compose.ts` |
| Operation | Per request | HTTP handler, test, CLI |

---

## Why this beats classes for this use case

A class mixes construction and operation in the same `this`:

```ts
class ReservationService {
    constructor(
        private db: Db,
        private cfg: RestaurantCfg,
    ) {}

    async reserve(input: ReservationInput) {
        // db and cfg accessed via this
    }
}
```

A factory separates them cleanly:

```ts
const makeReserve = ({ db, cfg }: ReserveCfg) => {
    const reserve = async (input: ReservationInput) => {
        // db and cfg captured in closure — no this
    };
    return { reserve };
};
```

The factory approach wins on three counts:

**No `this` binding bugs.** `this` in JavaScript is context-dependent.
Destructuring a method off a class instance can silently break it. Closures
never have this problem — the captured variable is always the same reference.

**Dependencies are visible at the boundary.** The `ReserveCfg` type declares
exactly what the operation needs. You cannot accidentally access something
not listed there.

**Cheap and honest testing.** You wire up a test instance by calling the
factory with test doubles. No mocking framework, no `new Service(mock1,
mock2)`. The factory is just a function.

---

## Connection to functional programming

### Partial application

Calling `makeReserve({ db, cfg })` is **partial application**: you fix
the dependency arguments now so the returned function only needs the
runtime arguments later.

Strict currying (`fn(a)(b)(c)`) is the mathematical version. Partial
application (fixing a group of arguments at once via a config object) is
the practical version. This project uses partial application.

### The Reader monad

In typed functional languages (Haskell, F#), the formal equivalent is the
**Reader monad**: a computation that depends on a shared environment. Your
factory is the same idea without the monad machinery.

`makeReserve({ db, cfg })` ≈ `Reader.ask(env => useEnv(env))` — the
environment is injected once, the computation sees it from then on.

If you later use `fp-ts` or `effect-ts`, the Reader pattern will feel
familiar because you have already been thinking in its terms.

### Mark Seemann on "dependency rejection"

Mark Seemann (author of *Dependency Injection Principles, Practices, and
Patterns*) argues that functional code does not need DI the way OOP code
does. In OOP, DI frameworks exist to work around the fact that objects
hide their dependencies. In FP, dependencies are explicit function
arguments — the type signature is the contract. Seemann calls this
**dependency rejection**: the function rejects the idea of hidden state
and requires every dependency to be passed explicitly.

This project is that idea applied to TypeScript.

---

## The object destructuring convention

**Inputs** always use a named config object:

```ts
// Good — names are visible at the call site
const { reserve } = makeReserve({ db, restaurantCfg, logger });

// Bad — positional, caller must read the signature to know order
const { reserve } = makeReserve(db, restaurantCfg, logger);
```

**Outputs** always use an object literal:

```ts
// Good — the key names what the factory produced
return { reserve };

// Inconsistent — caller cannot destructure
return reserve;
```

This means every call site in the project looks the same:

```ts
const { reserve }  = makeReserve({ db, restaurantCfg, logger });
const { evaluate } = makeGraphEvaluator({ repository });
const { create }   = makeCreateDocument({ repository, authzClient });
```

The pattern is completely predictable. You always know what to expect.

---

## Where the pattern lives in this project

```text
src/core/domain/          ← business operations (pure domain logic)
src/core/ports/           ← interfaces (what each factory depends on)
src/adapters/             ← concrete implementations (db, http, queue)
src/compose.ts            ← the one place everything is wired together
```

`compose.ts` is the **composition root** — the only file that knows which
concrete adapters are used. Everything else depends on interfaces. This is
the Ports and Adapters (Hexagonal Architecture) pattern at the wiring layer.

---

## Known trade-offs

**Not a singleton by default.** Each call to `makeReserve(...)` creates a
new closure. If you need a single shared instance, call it once in
`compose.ts` and pass the result around — which is exactly what this project
does.

**No magic wiring.** Unlike NestJS or InversifyJS, there is no container
scanning for decorators. You wire manually in `compose.ts`. This is more
verbose in a large codebase but completely transparent — you can always read
the composition root and trace every dependency.

**Closure memory.** Each factory call allocates a new closure scope. For
service-level objects created once at startup this is irrelevant. For
factories called thousands of times per second to create short-lived objects,
prefer plain functions with explicit arguments instead.

---

## Summary in one line

```text
make*(deps) closes over dependencies → returns { op } → op(args) runs at request time
```

This is partial application plus the Revealing Module Pattern plus Ports and
Adapters wiring — with no framework, no decorators, and no `this`.

---

## Further reading

**Factory functions and the Module Pattern**
- [From the Module Pattern to Factory Functions](https://medium.com/programming-essentials/from-the-module-pattern-to-factory-functions-a741cfbe818e) — Cristian Salcescu. Traces the evolution from IIFE → Revealing Module → reusable factory.
- [Factory Functions and the Module Pattern](https://www.theodinproject.com/lessons/node-path-javascript-factory-functions-and-the-module-pattern) — The Odin Project. Practical walkthrough with closure examples.
- [Factory functions](https://medium.com/@_ericelliott/factory-functions-b50d041bb023) — Eric Elliott. The primary advocate for replacing classes with factory functions in JavaScript.

**Functional Dependency Injection**
- [Functional Dependency Injection in TypeScript](https://hassannteifeh.medium.com/functional-dependency-injection-in-typescript-4c2739326f57) — Hassan Nteifeh. Walks through the exact pattern this project uses.
- [TypeScript FP Dependency Injection Is Easy!](https://dev.to/tareksalem/typescript-fp-dependency-injection-is-easy-18pn) — DEV Community.
- [Dependency Injection in TypeScript](https://mateuszsuchon.com/articles/dependency-injection-in-typescript) — Mateusz Suchoń. Contrasts functional and OOP approaches.
- [7 Ways to do Dependency Injection in Functional JavaScript](https://happy-css.com/articles/dependency-injection-in-java-script/) — Comprehensive comparison of DI styles in JS.
- [Dependency Injection, Currying and Partial Application](https://medium.com/@curtistatewilkinson/dependency-injection-currying-and-partial-application-for-easy-unit-tests-ded40c39016c) — Curtis Tate Wilkinson.

**The Reader Monad connection**
- [Dependency Injection and Reader Monad](https://dev.to/napicella/dependency-injection-and-reader-monad-5ap4) — DEV Community. Shows how factory functions are a practical Reader monad.
- [Purely functional dependency injection in TypeScript](https://anttih.com/articles/2018/07/05/purely-functional-di) — Antti Holvikari. Deep dive into the FP underpinnings.

**Mark Seemann — Dependency Rejection**
- [From Dependency Injection to Dependency Rejection](https://www.youtube.com/watch?v=cxs7oLGrxQ4) — Talk arguing that FP makes explicit DI containers unnecessary.

**Ports and Adapters (Hexagonal Architecture)**
- [Hexagonal Architecture](https://jmgarridopaz.github.io/content/hexagonalarchitecture.html) — Juan Manuel Garrido de Paz. The original pattern this wiring style implements.
- [Ports and Adapters Architecture](https://medium.com/the-software-architecture-chronicles/ports-adapters-architecture-d19f2d476eca) — Herberto Graça.
