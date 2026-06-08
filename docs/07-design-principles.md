# 07 — Design Principles in This Codebase

Every rule in this doc is demonstrated by actual code in this project.
Each section shows the rule, where you can see it, why it matters, and how to apply it.

---

## Table of contents

1. [Dependency Inversion Principle](#1-dependency-inversion-principle)
2. [Ports and Adapters (Hexagonal Architecture)](#2-ports-and-adapters-hexagonal-architecture)
3. [Inward Dependencies, Outward Control Flow](#3-inward-dependencies-outward-control-flow)
4. [Separation of Concerns](#4-separation-of-concerns)
5. [Single Responsibility Principle](#5-single-responsibility-principle)
6. [Composition Root](#6-composition-root)
7. [Functional Dependency Injection](#7-functional-dependency-injection)
8. [Program to Interfaces, Not Implementations](#8-program-to-interfaces-not-implementations)
9. [Interface Segregation Principle](#9-interface-segregation-principle)
10. [Design Async at the Boundary](#10-design-async-at-the-boundary)
11. [Types Live Close to Where They Are Used](#11-types-live-close-to-where-they-are-used)
12. [Keep Test Infrastructure Out of Production Code](#12-keep-test-infrastructure-out-of-production-code)
13. [Stubs vs Mocks](#13-stubs-vs-mocks)
14. [Arrange / Act / Assert](#14-arrange--act--assert)

---

## 1. Dependency Inversion Principle

**Rule:** High-level modules should not depend on low-level modules.
Both should depend on abstractions (interfaces).

**Where it lives in this codebase:**

`makeRestaurant` is high-level (it contains business logic). It does not import
`makeInMemoryDb` or `makeDynamoDb`. It only knows about the `DB` interface:

```ts
// src/restaurant/domain/makeRestaurant.ts
const makeRestaurant = ({ db, restaurantCfg, logger, metrics }: MakeRestaurantCfg) => {
  const reserve = async ({ quantity, date }: ReservationInput) => {
    await db.saveReservation({ quantity, date });  // ← calls the interface, not an implementation
    ...
  };
  // ... cancel, update, getReservations ...
  return { reserve, cancel, update, getReservations };
};
```

`ReserveCfg` requires `db: DB`, where `DB` is the driven port defined in `ports/db.ts`:

```ts
export interface DB {
    saveReservation: (input: ReservationInput) => Promise<Reservation>;
    getReservations: () => Promise<Reservation[]>;
    cancelReservation: (id: string) => Promise<boolean>;
    updateReservation: (id: string, input: ReservationInput) => Promise<Reservation | null>;
}
```

`makeInMemoryDb` and `makeDynamoDb` are low-level — they deal with storage details.
They implement `DB` but `reserve.ts` never imports them directly.

**Why it matters:**

If you import `makeInMemoryDb` directly inside `reserve.ts`, the business logic
is now coupled to the storage choice. Swapping to DynamoDB means editing the
business logic file — and that change has nothing to do with business logic.

With DIP, swapping storage is done entirely in `server/index.ts`, one line.
The business logic is not touched.

**How to apply it:**

Ask: "If I swap out X for a different implementation, which files change?"
If the answer includes files that contain business rules, you have a DIP violation.
The business rule file should only change when business rules change.

---

## 2. Ports and Adapters (Hexagonal Architecture)

Hexagonal architecture (also called "ports and adapters") is a way of organising
code so that your business logic is completely isolated from infrastructure concerns
like databases, HTTP, and logging.

The idea: imagine the domain at the centre of a hexagon. Each edge of the hexagon
is a **port** — a formally defined interface. The outside world connects to those
ports through **adapters** — concrete implementations that translate between the
real world and the interface the domain expects.

**Two kinds of ports:**

- **Driving ports** — the outside world calls _into_ the domain through these.
  They describe what callers can do with the domain.
  In this codebase: the `Restaurant` interface.

- **Driven ports** — the domain calls _out_ through these. They describe what
  the domain needs from infrastructure.
  In this codebase: `DB`, `Logger`, `Metrics`.

```
  Driving adapters                Domain                  Driven adapters
  (call the domain)               (pure business logic)   (serve the domain)

  makeRestaurantRouter ──┐                            ┌── makeInMemoryDb
                         │   ┌───────────────────┐    │
  makeRestaurantCli ─────┼──→│  reserve          │────┼── makeDynamoDb
                         │   │  cancel           │    │
                         │   │  update           │    ├── makeConsoleLogger
                         └──→│  getReservations  │    │
                             └───────────────────┘    └── makeNoOpMetrics

             calls via                        calls via
          Restaurant port                  DB / Logger / Metrics ports
           (driving port)                     (driven ports)
           defined in                         defined in
       domain/types.ts                   ports/db.ts (DB)
                                         ports/logger.ts (Logger)
                                         ports/metrics.ts (Metrics)
```

The domain defines _all_ ports. Adapters depend on the domain; the domain
depends on nothing outside itself.

**Where it lives in this codebase:**

| Port         | Kind    | Defined in         | Adapters that satisfy it                    |
| ------------ | ------- | ------------------ | ------------------------------------------- |
| `DB`         | Driven  | `ports/db.ts`      | `makeInMemoryDb`, `makeDynamoDb`            |
| `Logger`     | Driven  | `ports/logger.ts`  | `makeConsoleLogger`                         |
| `Metrics`    | Driven  | `ports/metrics.ts` | `makeNoOpMetrics`                           |
| `Restaurant` | Driving | `domain/types.ts`  | `makeRestaurantRouter`, `makeRestaurantCli` |

All three driven ports live together in `ports/`, each with a matching adapter
in `adapters/` — `ports/db.ts` ↔ `adapters/db/`, `ports/logger.ts` ↔
`adapters/logger/`, and so on. This is intentional: the core asks "what do I need
from infrastructure?" and the adapters answer by satisfying the interface. They
depend on the core; the core does not depend on them.

The one driving port, `Restaurant`, stays in `domain/types.ts` because it is the
core's own public surface — the shape `makeRestaurant` _produces_, not something an
adapter implements. The adapters that drive it (`makeRestaurantRouter` for HTTP,
`makeRestaurantCli` for the terminal) call _through_ it.

**Why it matters:**

Without this pattern, business logic becomes entangled with infrastructure.
Testing requires a real database. Changing from DynamoDB to PostgreSQL touches
business logic files.

With ports and adapters, the domain is a pure island. You can read
`makeRestaurant.ts` and understand all the business rules without
knowing anything about AWS, Express, or `console.log`.

**How to apply it:**

When you find yourself writing `import { DynamoDBClient } from "@aws-sdk/..."`
inside a business logic file, stop. Define an interface for what you need
(the port), put the AWS code in a separate file (the adapter), and inject the
adapter at the composition root.

---

## 3. Inward Dependencies, Outward Control Flow

**Rule:** _Source-code_ dependencies always point **inward**, toward the core.
_Control flow_ at runtime may point **outward**, from the core to infrastructure.
The two directions are opposite — and reconciling them is the whole point of the
pattern.

### Inward — who imports whom

Every `import` points toward the core. Nothing in the core imports an adapter.

```
   core (imports nothing outward)            infrastructure (imports inward)

   ports/db.ts        ←──────────────────┬── adapters/db/makeInMemoryDb.ts
   ports/logger.ts    ←──────────────────┼── adapters/db/makeDynamoDb.ts
   ports/metrics.ts   ←──────────────────┼── adapters/logger/makeConsoleLogger.ts
   domain/            ←──────────────────┼── adapters/http/makeRestaurantRouter.ts
    makeRestaurant.ts                     ├── server/compose.ts
                                          └── cli/compose.ts
```

- `domain/` imports `DB`, `Logger`, `Metrics` (abstract interfaces from `ports/`).
  It does not import `makeConsoleLogger.ts`, `makeDynamoDb.ts`, or `express`.
- `adapters/db/makeInMemoryDb.ts` imports `Reservation` (from `domain/types.ts`) and
  `DB` (from `ports/db.ts`). It imports _toward_ the core.

### Outward — who calls whom at runtime

At runtime, control flows the other way. When a reservation comes in, `reserve`
_calls outward_ to the database:

```ts
await db.saveReservation({ quantity, date }); // domain → infrastructure, at runtime
```

The domain _uses_ a database — but it never _imports_ one. It calls through the
`DB` port (an interface the core owns); the concrete `makeInMemoryDb` or
`makeDynamoDb` is handed to it at the composition root.

### How both can be true — Dependency Inversion

Control flows outward (`reserve` → `db`), but the source dependency points inward
(`makeInMemoryDb` → `DB`). They run in opposite directions because the **port sits
in the middle**:

```
   compile-time:  makeInMemoryDb ──imports──▶  DB  (port, lives in the core)
   runtime:       reserve ───────────calls───▶  db.saveReservation()
```

The adapter depends on the interface; the domain depends on the interface; neither
depends on the other. Inverting the source dependency (adapter → core, never
core → adapter) is exactly what lets control flow outward without the core ever
knowing infrastructure exists. This is the **Dependency Inversion Principle**
(section 1) applied at the module boundary: _source dependencies point against the
flow of control._

**Why it matters:**

The inward rule is what prevents circular dependencies. Imagine `DB` lived inside
`adapters/db/` and the domain imported it from there — then `adapters/db/` would
_also_ need `Reservation` from the domain, and you'd have a cycle: each module
needs the other to be understood, with no stable "inside".

By keeping every port in the core (`ports/`), adapters import the contract and the
domain types they need, and the core imports nothing from `db/`, `logger/`, or
`http/`. You can read `domain/` and `ports/` and understand the entire contract
without opening a single adapter.

**How to apply it:**

Draw your modules as concentric circles — domain at the centre, infrastructure at
the edges.

- Every `import` arrow must point **inward**. An outward import (core → adapter) is
  a violation — fix it by defining a port in the core and injecting the adapter at
  the composition root.
- Runtime **calls** may point outward, as long as they go through a port.

---

## 4. Separation of Concerns

**Rule:** Different kinds of concerns belong in different modules.
A module that handles HTTP should not contain business logic.
A module that contains business logic should not know about DynamoDB.

**Where it lives in this codebase:**

| Module              | Its one concern                                 |
| ------------------- | ----------------------------------------------- |
| `domain/`           | Business rules (can we take this reservation?)  |
| `adapters/db/`      | Persistence (save and retrieve data)            |
| `adapters/http/`    | HTTP transport (parse request, send response)   |
| `adapters/cli/`     | Terminal transport (parsed args → result line)  |
| `adapters/logger/`  | Structured log output                           |
| `adapters/metrics/` | Timing and counter instrumentation              |
| `ports/`            | Contracts (DB, Logger, Metrics interfaces)      |
| `server/compose.ts` | Wiring domain ops + HTTP adapter for the server |
| `server/index.ts`   | HTTP server startup, infrastructure             |
| `cli/compose.ts`    | Wiring domain ops + CLI adapter for the CLI     |
| `cli/index.ts`      | CLI entry point, infrastructure                 |

`makeRestaurantRouter.ts` handles HTTP concerns — it reads `req.body`,
validates the raw input, maps outcomes to status codes (201/422/400).
It does not contain the table-size check. That lives in `reserve.ts`.

`reserve.ts` contains the table-size check. It does not know about HTTP status codes,
JSON bodies, or DynamoDB table names.

**Why it matters:**

Mixing concerns makes code brittle. If your HTTP handler also contains the
business logic, a change to either requires touching the same file. Two engineers
working on different things collide. Tests become hard to write because you can't
test the business rule without also setting up an HTTP request.

**How to apply it:**

When a file starts doing two different kinds of things, split it.
A useful test: can you explain what a file does in one sentence without using "and"?
If not, it has too many concerns.

---

## 5. Single Responsibility Principle

**Rule:** A module should have one reason to change.

This is closely related to Separation of Concerns but focuses on _why_ a file
would need to be edited, not just what it does.

**Where it lives in this codebase:**

`makeRestaurantRouter.ts` would only change if:

- The API shape changes (different URL, different request/response format)

`reserve.ts` would only change if:

- The reservation business rules change (e.g., table size logic changes)

`makeInMemoryDb.ts` would only change if:

- The in-memory storage strategy changes

`makeDynamoDb.ts` would only change if:

- The DynamoDB interaction changes (different table schema, different SDK usage)

Each file has exactly one reason to change.

**Why it matters:**

When a file has multiple reasons to change, a change made for one reason can
accidentally break the other. The more reasons a file has to change, the more
often it will change, and the harder it becomes to keep it correct.

**How to apply it:**

Ask: "What would make me edit this file?" List the answers.
If the list has more than one item and they're unrelated to each other, split the file.

---

## 6. Composition Root

**Rule:** Wire all dependencies together in one place.
Nowhere else in the application should `new` or `make*` be called for
cross-cutting dependencies (logger, db, metrics).

**Where it lives in this codebase:**

The domain itself is one factory, `makeRestaurant`, so the operations are built
in one place. Each entry point then has a thin composition root —
`src/server/compose.ts` for the HTTP server, `src/cli/compose.ts` for the CLI —
that calls `makeRestaurant` and wraps it with its own driving adapter. All take
their deps as required parameters — no defaults, no infrastructure decisions
inside them:

```ts
// src/server/compose.ts  — builds the domain, adds the HTTP transport
const composeServerApp = ({ restaurantCfg, logger, metrics, db, port = 3000 }: ServerAppCfg) => {
    const restaurant = makeRestaurant({ db, logger, metrics, restaurantCfg });
    const router = makeRestaurantRouter({ restaurant });
    const app = makeRestaurantServer({ router, logger });

    const listen = (onReady) => app.listen(port, () => onReady(port));
    return { listen };
};
```

Infrastructure decisions (which logger? which db?) live in the entry points:

```ts
// src/server/index.ts
const logger = makeConsoleLogger();
const db = process.env.DYNAMODB_TABLE
    ? makeDynamoDb({
          tableName: process.env.DYNAMODB_TABLE,
          client,
          logger,
          generateId: randomUUID,
      })
    : makeInMemoryDb({ logger, generateId: randomUUID });

const { listen } = composeServerApp({ restaurantCfg: { tableSize }, logger, metrics, db, port });
listen();
```

`reserve.ts` never calls `makeConsoleLogger()` — it receives a logger.

**Why it matters:**

Without a composition root, wiring is scattered. A developer trying to understand
how the app is assembled has to read every file. With a composition root, the
entire dependency graph is visible in one place.

It also makes testing trivial: `makeApp({ ..., db: myFakeDb })` overrides the
database for the whole test without changing any production code.

**How to apply it:**

If you find yourself calling a constructor or factory inside a business logic
function, move that call up to the composition root and pass the result down.

---

## 7. Functional Dependency Injection

**Rule:** Express dependencies as function parameters, not imports.
The outer function (`make*`) takes dependencies and returns the inner function
(the operation) which closes over them.

**Where it lives in this codebase:**

```ts
// src/restaurant/domain/makeRestaurant.ts
const makeRestaurant = ({ db, restaurantCfg, logger, metrics }: MakeRestaurantCfg) => {
  //                     ↑ dependencies declared here, as parameters

  const reserve = async ({ quantity, date }: ReservationInput) => {
    //            ↑ a method callers actually use
    //              it closes over db, logger, metrics from the outer scope
    await db.saveReservation({ quantity, date });
    ...
  };

  // ... cancel, update, getReservations ...
  return { reserve, cancel, update, getReservations };
};
```

The naming convention is consistent across every module:

- The outer function is `make<Noun>` — it takes deps and returns the port (a noun)
- The port's methods are named after the operations (verbs) — what callers invoke

This pattern applies to `makeRestaurant`, `makeRestaurantRouter`,
`makeInMemoryDb`, `makeDynamoDb`, `makeConsoleLogger`, `makeNoOpMetrics`.

**Why it matters:**

A function that imports its own dependencies is hard to test — you have to mock
the module. A function that receives its dependencies as parameters can be tested
by simply passing different values in. No module mocking required.

It also makes the dependency graph explicit and visible. Reading the parameter list
of `makeRestaurant` tells you exactly what it needs to operate.

**How to apply it:**

Any time a function needs something that could vary (a logger, a database,
a config), add it as a parameter to the `make*` wrapper rather than importing
and calling it directly.

---

## 8. Program to Interfaces, Not Implementations

**Rule:** Reference the abstract type (the interface) in your code.
Pass concrete implementations only at the composition root.

**Where it lives in this codebase:**

`makeRestaurant` declares `db: DB`, not `db: ReturnType<typeof makeInMemoryDb>`.
`makeRestaurantRouter` takes `restaurant: Restaurant`, not the actual restaurant object type.

In tests, stubs satisfy the same interface:

```ts
// tests/reserve.test.ts
const stubDb: DB = {
    saveReservation: async (input) => ({ id: "stub-id", ...input }),
    getReservations: async () => [],
    cancelReservation: async () => false,
    updateReservation: async () => null,
};
```

TypeScript structurally checks that `stubDb` satisfies `DB`. No class, no `implements`.

**Why it matters:**

If you reference the concrete implementation, you can't swap it. The code becomes
tightly coupled to the current choice. Programming to the interface means any
object with the right shape will work — the test stub, the in-memory version, and
the real DynamoDB version are all interchangeable from `reserve.ts`'s perspective.

**How to apply it:**

In parameter types and return types, use the interface (`DB`, `Logger`, `Metrics`).
Only use the concrete type at the composition root where you construct the object.

---

## 9. Interface Segregation Principle

**Rule:** Interfaces should be small and focused.
Callers should not be forced to depend on methods they don't use.

**Where it lives in this codebase:**

`Logger` has exactly three methods:

```ts
export interface Logger {
    info: (message: string, data?: Record<string, unknown>) => void;
    warn: (message: string, data?: Record<string, unknown>) => void;
    error: (message: string, data?: Record<string, unknown>) => void;
}
```

`Metrics` has exactly two:

```ts
export interface Metrics {
    increment: (name: string) => void;
    timing: (name: string, durationMs: number) => void;
}
```

`DB` has exactly four — one for each operation the domain needs:

```ts
export interface DB {
    saveReservation: (input: ReservationInput) => Promise<Reservation>;
    getReservations: () => Promise<Reservation[]>;
    cancelReservation: (id: string) => Promise<boolean>;
    updateReservation: (id: string, input: ReservationInput) => Promise<Reservation | null>;
}
```

None of these interfaces have methods that only some callers would use.

**Why it matters:**

A large interface forces every implementor (including test stubs) to provide
methods that most callers never call. A `Logger` with 20 methods means every
stub has to implement 20 methods. Narrow interfaces mean stubs stay simple.

More importantly, a narrow interface communicates intent precisely — it says
"this is the exact contract, nothing more."

**How to apply it:**

When defining an interface, ask: "Will every caller use every method?"
If not, split the interface. When writing a stub for a test, if you find yourself
writing `methodICareAbout: vi.fn()` alongside `methodINeverCall: () => {}`,
that's a sign the interface may be too wide.

---

## 10. Design Async at the Boundary

**Rule:** If an interface may ever need to do I/O (network, disk, database),
make it async from the start — even when the current implementation is synchronous.

**Where it lives in this codebase:**

`makeInMemoryDb` does no real I/O. It could be synchronous:

```ts
saveReservation: (input: ReservationInput) => Reservation; // sync, simpler
```

But the `DB` interface is defined as async:

```ts
saveReservation: (input: ReservationInput) => Promise<Reservation>; // async
```

And the in-memory implementation matches:

```ts
const saveReservation = async (input: ReservationInput): Promise<Reservation> => {
    const reservation = { id: generateId(), ...input };
    store.push(reservation);
    return reservation;
};
```

**Why it matters:**

DynamoDB is async. Any real database is async. If the interface were synchronous,
swapping in `makeDynamoDb` would require changing the interface, `reserve.ts`,
all test stubs, and every caller — just to accommodate a change in I/O. That's a
lot of churn for a fact that was predictable from the beginning.

By making the interface async upfront, the swap to DynamoDB is a one-file change.

**How to apply it:**

Ask: "Could a production implementation of this interface ever need to do I/O?"
If yes, make the interface async now. The cost of `async/await` around a
synchronous operation is negligible. The cost of retrofitting async later is high.

---

## 11. Types Live Close to Where They Are Used

**Rule:** Define a type in the file or module that owns the concept.
Don't create a separate types file for types that are only used in one place.

**Where it lives in this codebase:**

`ServerAppCfg` is defined at the top of `server/compose.ts`. It's only used there.
`CliAppCfg` is defined at the top of `cli/compose.ts`. It's only used there.
Each type lives right next to the function that uses it — no extra file needed.

`Reservation`, `RestaurantCfg`, and `Restaurant` are all in `domain/types.ts`
because they are restaurant domain concepts. The `DB` port lives in `ports/db.ts`
with the other driven ports. Both are shared across multiple files, so a shared
types file within each is appropriate.

`InMemoryDbCfg` is defined at the top of `makeInMemoryDb.ts` — one file uses it,
so it lives there. Same for `DynamoDbCfg` in `makeDynamoDb.ts` and `ServerAppCfg`
in `server/compose.ts`. There is no `db/types.ts` — there was no second consumer.

**Why it matters:**

Scattering types into a single large shared types file creates a false sense of
organisation. Every time someone adds a type, it ends up in the dumping ground.
The file grows without structure, and reading it requires understanding context
from many different modules.

**How to apply it:**

Start by defining the type in the file that uses it. Move it to a shared location
only when a second file genuinely needs the same type. Never create a types file
before you have more than one consumer.

---

## 12. Keep Test Infrastructure Out of Production Code

**Rule:** Test doubles (stubs, fakes, mocks) do not belong in `src/`.
They are not production code. Treat the `src/` tree as the thing you ship.

**Where it lives in this codebase:**

`makeFakeMetrics` and `makeSilentLogger` are test helpers. They live in `tests/helpers/`,
not in `src/` — they are not production code:

```
tests/
  helpers/
    makeFakeMetrics.ts    ← test double: records calls for assertions
    makeSilentLogger.ts   ← test double: discards all log output
```

No production code imports from `tests/helpers/`.

**Why it matters:**

Keeping test infrastructure in `src/` blurs the line between what ships and what
doesn't. It can confuse new contributors who see `makeFakeMetrics.ts` in the source
tree and don't know whether it's used in production. It makes the production
dependency graph look larger than it is.

**How to apply it:**

If a file is only ever imported by test files, it does not belong in `src/`.
Move it to `tests/helpers/` or a `tests/fixtures/` directory.

---

## 13. Stubs vs Mocks

**Rule:** Use a stub (plain object, no `vi.fn()`) when you don't need to assert
on the interaction. Use a mock (`vi.fn()`) only when the test's assertion is
about whether and how the function was called.

**Where it lives in this codebase:**

Stubs in `reserve.test.ts` — these satisfy the interface and get out of the way:

```ts
const noOp = async () => {
    throw new Error("not implemented");
};
const stubDb: DB = {
    saveReservation: async (input) => ({ id: "stub-id", ...input }),
    getReservations: async () => [],
    cancelReservation: async () => false,
    updateReservation: async () => null,
};
const stubLogger: Logger = { info: () => {}, warn: () => {}, error: () => {} };
const stubMetrics: Metrics = { increment: () => {}, timing: () => {} };
```

Mocks in the same file — used only for the test that asserts on the interaction:

```ts
it("calls db.saveReservation with the reservation input on acceptance", async () => {
  const mockDb: DB = {
    saveReservation:   vi.fn(async (input) => ({ id: "x", ...input })),
    //                 ↑ vi.fn() because we assert on it below
    getReservations:   async () => [],
    cancelReservation: async () => false,
    updateReservation: async () => null,
  };
  ...
  expect(mockDb.saveReservation).toHaveBeenCalledWith({ quantity: 8, date: "12/12/12" });
});
```

**Why it matters:**

Using `vi.fn()` everywhere adds noise. Every test that uses a mock becomes
fragile because it can accidentally fail due to unexpected calls. Stubs are
inert — they satisfy the interface and get out of the way.

The distinction forces you to be precise about what each test is actually
verifying.

**How to apply it:**

Write stubs by default. Upgrade to a mock (`vi.fn()`) only when your assertion
is `toHaveBeenCalled` / `toHaveBeenCalledWith` — i.e., when the _call itself_
is the thing under test.

---

## 14. Arrange / Act / Assert

**Rule:** Structure every test in three sections: set up the state you need
(Arrange), perform the action under test (Act), then verify the outcome (Assert).
Never share state between tests via `beforeEach`.

**Where it lives in this codebase:**

Every test in this codebase follows the pattern explicitly:

```ts
it("calls restaurant.reserve with the parsed body", async () => {
    // Arrange
    const mockReserve = vi.fn(async (): Promise<"Accepted"> => "Accepted");
    const restaurant: Restaurant = {
        reserve: mockReserve,
        getReservations: async () => [],
    };

    // Act
    await request(makeTestApp(restaurant))
        .post("/api/reservations")
        .send({ quantity: 8, date: "12/12/25" });

    // Assert
    expect(mockReserve).toHaveBeenCalledWith({ quantity: 8, date: "12/12/25" });
});
```

Each test constructs its own state in the Arrange section. There is no
`beforeEach` that creates shared state across tests.

**Why it matters:**

`beforeEach` state is invisible at the test site. To understand a failing test
you have to read the test _and_ the setup block and mentally combine them.
With AAA, the test is completely self-contained — everything relevant is visible
in the test body.

Shared state between tests also creates ordering dependencies: test B can fail
because test A modified the shared object. Tests should never interact.

**How to apply it:**

Each test creates what it needs. If you find yourself writing `beforeEach`,
ask whether each test actually needs _all_ of the shared state, or whether
that state differs slightly between tests. If it differs, it belongs in the
test body. If it's truly identical and the setup is genuinely expensive (e.g.,
starting a real server), `beforeEach` is acceptable — but this is rare.

---

## How the principles connect

These aren't independent rules. They reinforce each other:

- **DIP** gives you interfaces → **Program to interfaces** becomes natural
- Interfaces let you **inject dependencies functionally** → tests use **stubs and mocks** instead of real infrastructure
- **Separation of concerns** into modules → the **inward dependency rule** tells you which direction imports should point
- **Ports and adapters** is the architectural shape that DIP and SoC produce together
- **Composition root** is where all the functional DI wires come together
- **Async at the boundary** is DIP applied to the dimension of time (sync vs async)

If you follow them all, you end up with a codebase where:

- Business logic is readable without knowing about any infrastructure
- Tests are fast because they never touch real databases or networks
- Swapping a dependency (in-memory → DynamoDB, console → structured logger) is a one-line change at the composition root
- Any module can be read and understood in isolation
