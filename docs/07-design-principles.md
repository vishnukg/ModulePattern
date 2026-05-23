# 07 — Design Principles in This Codebase

Every rule in this doc is demonstrated by actual code in this project.
Each section shows the rule, where you can see it, why it matters, and how to apply it.

---

## Table of contents

1. [Dependency Inversion Principle](#1-dependency-inversion-principle)
2. [Ports and Adapters (Hexagonal Architecture)](#2-ports-and-adapters-hexagonal-architecture)
3. [Inward Dependency Rule](#3-inward-dependency-rule)
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

`reserve.ts` is high-level (it contains business logic). It does not import
`makeInMemoryDb` or `makeDynamoDb`. It only knows about the `DB` interface:

```ts
// src/modules/restaurant/reserve.ts
const makeReserve = ({ db, restaurantCfg, logger, metrics }: ReserveCfg) => {
  const reserve = async ({ quantity, date }: Reservation) => {
    await db.saveReservation({ quantity, date });  // ← calls the interface, not an implementation
    ...
  };
  return reserve;
};
```

`ReserveCfg` requires `db: DB`, where `DB` is:

```ts
export type DB = {
  saveReservation: (reservation: Reservation) => Promise<void>;
  getReservations: () => Promise<Reservation[]>;
};
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

**Rule:** Define what your domain *needs* as an interface (port).
Write implementations of that interface separately (adapters).
The domain owns the port definition; adapters depend on the domain.

**Where it lives in this codebase:**

```
Domain (restaurant/)
  ├── types.ts           ← defines DB (the port)
  ├── reserve.ts         ← uses the port
  └── makeRestaurant.ts  ← assembles the domain object

Adapters (db/)
  ├── makeInMemoryDb.ts  ← implements the port (in-memory)
  └── makeDynamoDb.ts    ← implements the port (AWS DynamoDB)
```

The `DB` interface is defined inside `restaurant/types.ts` — the domain module —
not inside `db/types.ts`. This is intentional. The domain asks the question:

> "What do I need a data store to be able to do?"

The adapters answer that question by satisfying the interface. They depend on the
domain; the domain does not depend on them.

The same pattern applies to `Logger` and `Metrics`. The restaurant domain uses them;
`consoleLogger.ts`, `makeNoOpMetrics.ts` are the adapters that implement them.

**Why it matters:**

Without this pattern, your business logic becomes entangled with infrastructure.
Testing requires a real database. Changing from DynamoDB to PostgreSQL touches
business logic files. The codebase becomes hard to reason about because concerns
are mixed.

With ports and adapters, the domain is a pure island. You can read it and understand
the business rules without knowing anything about AWS, Express, or console.log.

**How to apply it:**

When you find yourself writing `import { DynamoDBClient } from "@aws-sdk/..."` 
inside a business logic file, stop. Define an interface for what you need,
put the AWS code in a separate adapter file, and inject the adapter at the
composition root.

---

## 3. Inward Dependency Rule

**Rule:** Dependencies point inward, toward the domain.
The domain imports nothing from infrastructure.
Infrastructure imports from the domain.

**Where it lives in this codebase:**

```
logger/types.ts     ←── restaurant/types.ts  ←── db/makeInMemoryDb.ts
metrics/types.ts    ←──      (domain)         ←── db/makeDynamoDb.ts
                                              ←── http/makeRestaurantRouter.ts
                                              ←── server/compose.ts
                                              ←── cli/compose.ts
```

`restaurant/types.ts` imports `Logger` and `Metrics` (abstract interfaces).
It does not import `consoleLogger.ts`, `makeDynamoDb.ts`, or `express`.

`db/makeInMemoryDb.ts` imports `Reservation` and `DB` from `restaurant/types.ts`.
It imports *toward* the domain.

**Why it matters:**

This rule is what makes the circular dependency we fixed a real problem.
Before the fix, `db/types.ts` imported `Reservation` from `restaurant/types.ts`,
AND `restaurant/types.ts` imported `DB` from `db/types.ts`. Each module needed
the other to be understood. There was no "inside" — no stable core.

After the fix, you can read `restaurant/types.ts` and understand the entire domain
without opening a single file in `db/`, `logger/`, or `http/`.

**How to apply it:**

Draw your modules as concentric circles. Domain at the centre.
Infrastructure at the edges. Allow arrows to point inward only.
Any arrow pointing outward (domain → infrastructure) is a violation.

---

## 4. Separation of Concerns

**Rule:** Different kinds of concerns belong in different modules.
A module that handles HTTP should not contain business logic.
A module that contains business logic should not know about DynamoDB.

**Where it lives in this codebase:**

| Module            | Its one concern                        |
|-------------------|----------------------------------------|
| `restaurant/`     | Business rules (can we take this reservation?) |
| `db/`             | Persistence (save and retrieve data)   |
| `http/`           | HTTP transport (parse request, send response) |
| `logger/`         | Structured log output                  |
| `metrics/`        | Timing and counter instrumentation     |
| `server/compose.ts` | Wiring domain ops for the HTTP server  |
| `server/index.ts`   | HTTP server startup, infrastructure    |
| `cli/compose.ts`    | Wiring domain ops for the CLI          |
| `cli/index.ts`      | CLI entry point, infrastructure        |

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

This is closely related to Separation of Concerns but focuses on *why* a file
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

Each entry point has its own composition root. `src/server/compose.ts` wires
the domain operations for the HTTP server; `src/cli/compose.ts` wires what
the CLI needs. Both take all deps as required parameters — no defaults, no
infrastructure decisions inside them:

```ts
// src/server/compose.ts
const makeServerApp = ({ restaurantCfg, logger, metrics, db }: ServerAppCfg) => {
  const reserve    = makeReserve({ db, logger, metrics, restaurantCfg });
  const cancel     = makeCancel({ db, logger, metrics });
  const update     = makeUpdate({ db, logger, metrics, restaurantCfg });
  const restaurant = makeRestaurant({ reserve, cancel, update, getReservations: db.getReservations });
  return { restaurant };
};
```

Infrastructure decisions (which logger? which db?) live in the entry points:

```ts
// src/server/index.ts
const logger = makeConsoleLogger();
const db     = process.env.DYNAMODB_TABLE
  ? makeDynamoDb({ tableName: process.env.DYNAMODB_TABLE, ... })
  : makeInMemoryDb({ logger });

const { restaurant } = makeServerApp({ restaurantCfg: { tableSize }, logger, metrics, db });
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
// src/modules/restaurant/reserve.ts
const makeReserve = ({ db, restaurantCfg, logger, metrics }: ReserveCfg) => {
  //                  ↑ dependencies declared here, as parameters

  const reserve = async ({ quantity, date }: Reservation) => {
    //            ↑ this is the function callers actually use
    //              it closes over db, logger, metrics from the outer scope
    await db.saveReservation({ quantity, date });
    ...
  };

  return reserve;
};
```

The naming convention is consistent across every module:
- The outer function is `make<OperationName>` — it takes deps and returns the operation
- The inner function is named after the operation — it's what the caller invokes

This pattern applies to `makeReserve`, `makeRestaurant`, `makeRestaurantRouter`,
`makeInMemoryDb`, `makeDynamoDb`, `makeConsoleLogger`, `makeNoOpMetrics`.

**Why it matters:**

A function that imports its own dependencies is hard to test — you have to mock
the module. A function that receives its dependencies as parameters can be tested
by simply passing different values in. No module mocking required.

It also makes the dependency graph explicit and visible. Reading the parameter list
of `makeReserve` tells you exactly what it needs to operate.

**How to apply it:**

Any time a function needs something that could vary (a logger, a database,
a config), add it as a parameter to the `make*` wrapper rather than importing
and calling it directly.

---

## 8. Program to Interfaces, Not Implementations

**Rule:** Reference the abstract type (the interface) in your code.
Pass concrete implementations only at the composition root.

**Where it lives in this codebase:**

`reserve.ts` declares `db: DB`, not `db: ReturnType<typeof makeInMemoryDb>`.
`makeRestaurantRouter` takes `restaurant: Restaurant`, not the actual restaurant object type.

In tests, stubs satisfy the same interface:

```ts
// tests/reserve.test.ts
const stubDb: DB = {
  saveReservation: async () => {},
  getReservations: async () => [],
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
  timing:    (name: string, durationMs: number) => void;
}
```

`DB` has exactly two:
```ts
export type DB = {
  saveReservation: (reservation: Reservation) => Promise<void>;
  getReservations: () => Promise<Reservation[]>;
};
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
saveReservation: (r: Reservation) => void          // sync, simpler
```

But the `DB` interface is defined as async:
```ts
saveReservation: (reservation: Reservation) => Promise<void>  // async
```

And the in-memory implementation matches:
```ts
const saveReservation = async (reservation: Reservation): Promise<void> => {
  reservations.push(reservation);
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

`Reservation`, `RestaurantCfg`, `DB`, `Restaurant` are all in `restaurant/types.ts`
because they are all restaurant domain concepts. They're used across multiple files,
so a shared types file within the module is appropriate.

`InMemoryDbCfg` and `DynamoDbCfg` live in `db/types.ts` because they're
specific to the db module's infrastructure implementations.

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

`makeFakeMetrics` and `makeSilentLogger` are test helpers. They used to live in
`src/modules/metrics/fakeMetrics.ts` and `src/modules/logger/silentLogger.ts`.
They now live in `tests/helpers/`:

```
tests/
  helpers/
    fakeMetrics.ts    ← test double: records calls for assertions
    silentLogger.ts   ← test double: discards all log output
```

No production code imports from `tests/helpers/`.

**Why it matters:**

Keeping test infrastructure in `src/` blurs the line between what ships and what
doesn't. It can confuse new contributors who see `fakeMetrics.ts` in the source
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

Stubs in `reserve.test.ts` — these are shared across many tests that don't
care about the interaction:

```ts
const stubDb: DB           = { saveReservation: async () => {}, getReservations: async () => [] };
const stubLogger: Logger   = { info: () => {}, warn: () => {}, error: () => {} };
const stubMetrics: Metrics = { increment: () => {}, timing: () => {} };
```

Mocks in the same file — used only for the test that asserts on the interaction:

```ts
it("calls db.saveReservation with the reservation on acceptance", async () => {
  const mockDb: DB = { saveReservation: vi.fn(async () => {}), getReservations: async () => [] };
  //                                    ↑ vi.fn() because we assert on it below
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
is `toHaveBeenCalled` / `toHaveBeenCalledWith` — i.e., when the *call itself*
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
  const restaurant: Restaurant = { reserve: mockReserve, getReservations: async () => [] };

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
you have to read the test *and* the setup block and mentally combine them.
With AAA, the test is completely self-contained — everything relevant is visible
in the test body.

Shared state between tests also creates ordering dependencies: test B can fail
because test A modified the shared object. Tests should never interact.

**How to apply it:**

Each test creates what it needs. If you find yourself writing `beforeEach`,
ask whether each test actually needs *all* of the shared state, or whether
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
