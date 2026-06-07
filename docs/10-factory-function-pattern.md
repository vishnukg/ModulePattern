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
const reserve = makeReserve({ db, restaurantCfg, logger, metrics });

// Runtime — called once per HTTP request
await reserve({ quantity: 2, date: "2024-12-01" });
```

This separates two very different concerns:

| Phase        | When        | Who calls it            |
| ------------ | ----------- | ----------------------- |
| Construction | Startup     | `compose.ts`            |
| Operation    | Per request | HTTP handler, test, CLI |

---

## The mental model: it's a tree

The whole app is a dependency tree. The one core idea behind everything below:
**separate _what each piece does_ from _how the pieces are connected_ — and never
let a piece reach out for its own dependencies; they are always handed to it.**

`make*` answers "what does this one thing do?" `compose*` answers "how are the
things wired together?" That single split is the entire pattern. Here is the tree
for this project, from the real world (top) down to the actual work (bottom):

```text
      THE REAL WORLD   (env vars, which DB?, sockets, process start)
            │
            ▼
┌────────────────────────────────────────────────────────────────────────┐
│  index.ts   --   TRUNK  (the entry point)                              │
│  - picks the concrete adapters: makeInMemoryDb, makeConsoleLogger ...  │
│  - calls the top branch, then runs it:  listen()                       │
└────────────────────────────────────────────────────────────────────────┘
            │   dependencies handed DOWN
            ▼
composeServerApp             BRANCH  (composition root)  →  returns { listen }
├─ composeRestaurant         BRANCH  (sub-composition)   →  returns a Restaurant
│   ├─ makeReserve           leaf
│   ├─ makeCancel            leaf
│   ├─ makeUpdate            leaf
│   ├─ makeGetReservations   leaf  (thin pass-through to the DB)
│   └─ makeRestaurant        leaf  (bundles the four operations)
├─ makeRestaurantRouter      leaf
└─ makeRestaurantServer      leaf
```

Two things flow along the tree, in opposite directions and at different times —
this is the [two-call shape](#the-two-call-shape) seen from above:

```text
WIRING TIME  (once, at startup):      dependencies flow DOWN
    trunk  →  branches  →  leaves      (db, logger handed downward)

RUNTIME  (per request, many times):   a request flows IN, a result comes back
    reserve({ quantity, date })  →  "Accepted"
```

### Leaf vs branch vs trunk

The tree metaphor maps almost perfectly — and it's the quickest way to _feel_
the rule before reading its precise form below.

**🍃 Leaf = `make*` — does the actual work.**

- A leaf is where photosynthesis happens: it turns inputs into something useful.
  `makeReserve` turns a booking into `"Accepted"` / `"Rejected"`.
- It is **fed, it doesn't forage.** A leaf has water and light delivered to it; it
  never goes looking. `makeReserve` is _handed_ `db` / `logger`; it never imports a
  concrete database.
- It is **terminal** — nothing grows past a leaf. A `make*` calls **no other
  factory**; it's where the tree stops. (This is exactly what `npm run audit`
  checks.)
- Leaves share one shape: `(deps) => capability`. `makeReserve`, `makeInMemoryDb`,
  `makeRestaurantRouter` — same silhouette, different work.

**🌿 Branch = `compose*` — connects, but does no work of its own.**

- A branch doesn't photosynthesize; it **holds leaves in position** and channels
  resources to them. `composeServerApp` invents no behaviour — it arranges
  behaviour that leaves already provide.
- Branches **carry branches**: `composeServerApp` holds `composeRestaurant` (a
  smaller branch) _plus_ leaves. The tree nests to any depth.
- Its entire reason to exist is **connection**. Break a leaf and the app loses a
  capability; break a branch and the pieces are fine — they're just no longer
  joined.

**🪵 Trunk = entry point (`index.ts`) — where the tree meets the ground.**

- The trunk is the only part touching **soil**: env vars, _which_ database,
  _which_ logger, starting the process.
- It **chooses the concrete reality**, hands it up the tree, then lets everything
  run. Above the trunk nothing knows whether the DB is in-memory or DynamoDB —
  only the _port_ (the shape), never the concrete thing.

**🍂 Plain functions = not part of the tree at all.**

- `formatReport`, a validator, a data transform — these aren't factories and hold
  no dependencies. They're tools applied to data _flowing through_ the tree, which
  is why they get **no** `make*` / `compose*` prefix.

Two rules we follow elsewhere fall straight out of this picture: a branch hands up
only the capability the trunk runs (**return only what's driven** — never dangle
the whole sub-tree out the side), and the trunk owns concreteness (**adapter
selection lives in `index.ts`**, so everything above depends on ports).

---

## make vs compose: when to use which

Both `make*` and `compose*` are factory functions — you call them once at
startup and they return something you use later. The prefix tells you the
function's **job**. Here is the entire rule.

**`make*` = manufacture ONE thing.**
A `make*` takes its dependencies (already built) and returns a single **port** —
one function, or one object that implements one interface. It writes its logic
**inline**; it does not call other factories to assemble itself. It is a _leaf_:
the place a capability is actually defined.

**`compose*` = assemble things that already exist.**
A `compose*` **calls other factories** (`make*`, and sometimes other `compose*`)
and/or **chooses which concrete adapter to use**, then wires the results
together. It defines no new behaviour of its own — it connects behaviour that
`make*` functions already provide. It is a _branch_.

### The one test that decides it

Open the function body and ask:

> **Does it call another factory (`make*` / `compose*`) to build one of its parts?**
>
> - **No** → it's a **`make*`**. (Its work is written inline.)
> - **Yes** → it's a **`compose*`**. (It assembles other factories.)

That is the whole rule. The **return type does not matter**: a `compose*` may
return a single named port (when it just assembles one domain) or a bag of peers
(when it's an entry point's root). What makes it a compose is _calling other
factories_, not what it returns.

The clearest proof is `makeRestaurant` vs `composeRestaurant` — **both return a
`Restaurant`**, yet:

```ts
// make: it is HANDED the operations and just bundles them → calls no factory
const makeRestaurant = ({ reserve, cancel, update, getReservations }): Restaurant => ({
    reserve,
    cancel,
    update,
    getReservations,
});

// compose: it BUILDS the operations via make* factories, then bundles them
const composeRestaurant = ({ db, logger, metrics, restaurantCfg }): Restaurant => {
    const reserve = makeReserve({ db, logger, metrics, restaurantCfg });
    const cancel = makeCancel({ db, logger, metrics });
    const update = makeUpdate({ db, logger, metrics, restaurantCfg });
    const getReservations = makeGetReservations({ db });
    return makeRestaurant({ reserve, cancel, update, getReservations });
};
```

They look interchangeable because they return the same `Restaurant`, but they sit
at different layers:

|                      | `makeRestaurant`                     | `composeRestaurant`                                               |
| -------------------- | ------------------------------------ | ----------------------------------------------------------------- |
| **Takes in**         | the four finished operations         | raw infrastructure (`db`, `logger`, `metrics`, `cfg`)             |
| **Does**             | nothing but bundle what it is handed | **builds** the operations (`makeReserve` etc.), then bundles them |
| **Returns**          | a `Restaurant`                       | a `Restaurant`                                                    |
| **Calls a factory?** | no → it's a **`make`** (leaf)        | yes → it's a **`compose`** (branch)                               |

The kitchen analogy: **`makeRestaurant` is the tray** — hand it four cooked dishes
and it arranges them into a meal; it never cooks. **`composeRestaurant` is the
kitchen** — it takes raw ingredients (`db` / `logger` / `metrics`), cooks the four
dishes (`makeReserve` / `makeCancel` / `makeUpdate` / `makeGetReservations`), then
puts them on the tray.

### We wrap every domain operation — even pure pass-throughs

Notice all four operations in `composeRestaurant` are built the **same way**,
`getReservations` included:

```ts
const reserve = makeReserve({ db, logger, metrics, restaurantCfg });
const cancel = makeCancel({ db, logger, metrics });
const update = makeUpdate({ db, logger, metrics, restaurantCfg });
const getReservations = makeGetReservations({ db }); // ← even this one
return makeRestaurant({ reserve, cancel, update, getReservations });
```

`getReservations` is the odd one out behaviourally: it adds **no** domain logic
today. Listing reservations is exactly what the database already does, and
`db.getReservations` is already the domain's signature (`() => Promise<Reservation[]>`),
so its factory is a one-line wrapper:

```ts
const makeGetReservations =
    ({ db }: { db: DB }): GetReservationsFn =>
    () =>
        db.getReservations();
```

We **could** have skipped it and wired `db.getReservations` straight through. We
wrap it anyway, on purpose, for two reasons:

- **One rule, not two.** Every domain operation is a `make*` factory — no "is this
  one wrapped, or passed straight through?" exception to carry in your head when
  reading or writing `composeRestaurant`.
- **The seam is already there.** The day `getReservations` needs a filter,
  pagination, an audit log, or a metric, you add it _inside_ `makeGetReservations`
  — `composeRestaurant` and every call site stay byte-for-byte unchanged.

The other three were never optional: each genuinely **transforms** the DB's raw
result into the domain's vocabulary, so the factory was always doing real work.

| Domain op         | DB method it uses      | What its factory adds                                                                      |
| ----------------- | ---------------------- | ------------------------------------------------------------------------------------------ |
| `reserve`         | `db.saveReservation`   | the capacity rule (`quantity ≤ tableSize`) → `"Accepted"` / `"Rejected"`, metrics, logging |
| `cancel`          | `db.cancelReservation` | maps the DB's `boolean` → `"Cancelled"` / `"NotFound"`, metrics, logging                   |
| `update`          | `db.updateReservation` | maps `Reservation \| null` → `"Updated"` / `"Rejected"` / `"NotFound"`, the capacity rule  |
| `getReservations` | `db.getReservations`   | **nothing today** — wrapped for consistency and a ready extension seam                     |

**The rule:** every domain operation gets a `make*` factory — even a pure
pass-through. The cost is one trivial wrapper; the payoff is a single uniform rule
and a place for behaviour to land later. (Minimalism — wiring pass-throughs
straight through and skipping the wrapper — is the valid alternative; this project
chooses consistency.)

### This repo, function by function

| Function                                                         | Kind       | Why                                                                                          |
| ---------------------------------------------------------------- | ---------- | -------------------------------------------------------------------------------------------- |
| `makeReserve`, `makeCancel`, `makeUpdate`                        | `make*`    | define the operation inline from `db`/`logger`/`metrics`                                     |
| `makeGetReservations`                                            | `make*`    | thin pass-through to `db.getReservations` — wrapped for consistency (see above)              |
| `makeRestaurant`                                                 | `make*`    | bundles operations it is **handed** — calls no factory                                       |
| `makeInMemoryDb`, `makeRestaurantRouter`, `makeRestaurantCli`, … | `make*`    | define their behaviour inline                                                                |
| `composeRestaurant`                                              | `compose*` | calls `makeReserve` / `makeCancel` / `makeUpdate` / `makeGetReservations` / `makeRestaurant` |
| `composeServerApp`, `composeCliApp`                              | `compose*` | call `composeRestaurant` + a driving adapter, return a bag of peers                          |

### A third kind: plain functions

Not every function is a factory. A function that takes data and returns data — a
transform, a formatter, a validator — is just an ordinary function. Don't give
it a `make*` / `compose*` prefix. Those prefixes are **only** for the wiring
layer: building and connecting the ports your app depends on.

### This rule is enforced, not just documented

`npm run audit` (`scripts/audit-factories.mjs`) scans every `.ts` file and fails
the build if a `make*` builds a collaborator (it should be `compose*`) or a
`compose*` builds nothing (it should be `make*`). It runs in CI via `make ci`.
The script exists because this boundary is otherwise kept only by discipline —
see [When to choose something else](#when-to-choose-something-else) for patterns
that move the same guarantee into the compiler instead.

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
    return reserve;
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

Mark Seemann (author of _Dependency Injection Principles, Practices, and
Patterns_) argues that functional code does not need DI the way OOP code
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
const reserve = makeReserve({ db, restaurantCfg, logger });

// Bad — positional, caller must read the signature to know order
const reserve = makeReserve(db, restaurantCfg, logger);
```

**Outputs** follow two rules depending on the function type:

`make*` functions return the port directly — the returned value IS the thing
the caller needs. When the port is a single operation, that is a function;
when the port is a multi-method interface, that is an object:

```ts
// Single-operation port — the function IS the port
const makeReserve = (cfg: ReserveCfg): ReserveFn => {
    return async (input) => {
        /* ... */
    };
};
const reserve = makeReserve({ db, restaurantCfg, logger, metrics });

// Multi-method port — the object IS the port
const makeInMemoryDb = (cfg: InMemoryDbCfg): DB => {
    return { saveReservation, getReservations, cancelReservation, updateReservation };
};
const db = makeInMemoryDb({ logger, generateId });
```

`compose*` functions return **whatever the caller needs** — sometimes a single
assembled port (when the job is just to build one thing), sometimes a named bag
of peers (when an entry point needs several). Each entry-point root here returns
the one capability its `index.ts` drives:

```ts
// Composition roots — each returns the single capability its entry point drives
const composeServerApp = (cfg) => {
    // ... wiring ...
    return { listen };
};

const composeCliApp = (cfg) => {
    // ... wiring ...
    return { cli };
};

// Domain assembly reused by both entry points — returns the Restaurant port.
// Integration tests call this directly to drive the domain without a transport.
const composeRestaurant = (cfg): Restaurant => {
    // ... builds reserve/cancel/update, bundles them ...
    return makeRestaurant({ reserve, cancel, update, getReservations });
};
```

Call sites are predictable — a `compose*` that returns one port is captured
directly; one that returns a named bag is destructured:

```ts
// returns a single port → capture directly
const restaurant = composeRestaurant({ db, restaurantCfg, logger, metrics });

// returns a named bag → destructure what you need
const { listen } = composeServerApp({ restaurantCfg, logger, metrics, db, port });
const { cli } = composeCliApp({ restaurantCfg, logger, metrics, db });
```

---

## Where the pattern lives in this project

```text
src/restaurant/domain/                    ← business operations (pure domain logic)
src/restaurant/domain/composeRestaurant.ts ← assembles the domain once (reused by both entry points)
src/restaurant/ports/                     ← interfaces (what each factory depends on)
src/restaurant/adapters/                  ← concrete implementations (db, http, queue)
src/server/compose.ts                     ← composition root for the HTTP server
src/cli/compose.ts                        ← composition root for the CLI
```

Each `compose.ts` is a **composition root** — the only file for its entry
point that knows which concrete adapters are used. Everything else depends
on interfaces. This is
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

## When to choose something else

This pattern — factory functions plus a hand-written composition root — is the
right default for small-to-medium apps that value clarity and zero magic. But it
is one point on a spectrum, and it has real costs: manual wiring grows linearly
with the app, and the make/compose split is a _convention_ you must keep honest
(which is why this repo ships an [audit](#this-rule-is-enforced-not-just-documented)).
Here is the spectrum, simplest → heaviest:

| Approach                                                     | vs. this repo                                                      | Choose it when                                                                                                |
| ------------------------------------------------------------ | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| **Plain functions, deps as params** — `reserve(deps, input)` | drops the factory/closure layer entirely                           | the app is tiny or the logic is mostly pure; you want the least machinery                                     |
| **Factory functions + manual compose** _(this repo)_         | —                                                                  | small-to-medium apps; clarity and traceability matter most                                                    |
| **One typed `deps` bag threaded through**                    | a single `AppDeps` object instead of per-factory configs           | wiring churn hurts — but you accept weaker "visible dependencies at the boundary"                             |
| **Effect-TS `Layer`s (or fp-ts `Reader`)**                   | a _compiler-checked_ composition root, plus typed errors/resources | you want the type system to prove the graph is wired                                                          |
| **DI container (NestJS, tsyringe)**                          | decorators auto-wire at runtime                                    | a large team/app where manual wiring is genuinely too much, and you accept reflection + runtime wiring errors |

The honest weakness of _this_ pattern: the make/compose boundary is enforced by
discipline, not the compiler. A wiring mistake — a domain function that quietly
constructs its own database — is just code that runs. The `npm run audit` script
narrows that gap for the _naming_ rule, but it cannot prove the _graph_ is
correct. The next patterns up the ladder move that guarantee into the type system.

## How Effect-TS would do this

Effect-TS is essentially "this pattern, leveled up" — the same ports / adapters /
composition-root ideas, but the **compiler tracks the dependency graph for you**.
The mapping is almost one-to-one:

| This repo                         | Effect-TS                                                  |
| --------------------------------- | ---------------------------------------------------------- |
| a port (`DB`, `Logger` interface) | a `Context.Tag` — a typed key identifying a service        |
| a `make*` adapter                 | a value provided through a `Layer`                         |
| a `compose*` / composition root   | `Layer` composition (`Layer.provide` / `Layer.merge`)      |
| the domain op (`reserve`)         | an `Effect<A, E, R>` — `R` is the set of services it needs |
| `index.ts` running the app        | `Effect.runPromise(program.pipe(Effect.provide(AppLive)))` |

A sketch of our `reserve` in Effect:

```ts
import { Context, Effect, Layer } from "effect";

// A port becomes a Tag — a typed token for a service.
class Db extends Context.Tag("Db")<
    Db,
    {
        saveReservation: (input: ReservationInput) => Effect.Effect<Reservation>;
    }
>() {}

// The domain reads services from context instead of taking a config object.
// Its type carries the dependency: Effect<Reservation, never, Db>.
const reserve = (input: ReservationInput) =>
    Effect.gen(function* () {
        const db = yield* Db; // ← dependency, tracked in the type
        return yield* db.saveReservation(input);
    });

// An adapter is provided as a Layer (this fuses make* with the wiring step).
const DbLive = Layer.succeed(Db, {
    saveReservation: (input) => Effect.succeed({ id: "r1", ...input }),
});

// The composition root is just Layer composition.
const AppLive = DbLive; // .pipe(Layer.provideMerge(LoggerLive)), etc.

// Running provides the layers. Forget one and it does NOT compile.
Effect.runPromise(reserve(input).pipe(Effect.provide(AppLive)));
```

What you gain over the manual approach:

- **The dependency graph is type-checked.** `reserve`'s type is
  `Effect<…, …, Db>`; that `Db` in the third slot is an _unmet_ dependency, and
  `Effect.provide` discharges it. Forget to provide a service and it won't
  compile — exactly the guarantee our `audit` script can only _approximate_.
- **Resources and lifetimes are built in.** `Layer` handles acquire/release
  (connections, files) and memoizes services (singletons) — no "singleton by
  convention".
- **Typed errors and concurrency.** The `E` channel puts failures in the type,
  and Effect has first-class structured concurrency and interruption.

The cost is real: a steep learning curve, and the _whole_ app adopts the `Effect`
type. For a learning repo it's a "later" tool — but when manual wiring starts to
ache, `Layer` is the principled next step, **not** a decorator-based container.

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
