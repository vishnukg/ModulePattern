# The Patterns in This Project

How the `make*` factory pattern, barrel files, and `compose.ts` fit together.

---

## 1. The `make*` factory pattern

Each port in this project is built by a `make*` function — named for the **noun**
it produces, with its operations exposed as **methods** (the verbs):

```
make*(dependencies) → port  →  port.operation(runtimeArgs) → result
```

The `make*` function is called once during wiring (in `compose.ts`).
The returned port's methods are what get called at runtime — once per request.

```ts
// src/restaurant/domain/makeRestaurant.ts
const makeRestaurant = ({ db, restaurantCfg, logger, metrics }: MakeRestaurantCfg): Restaurant => {
    const reserve = async ({
        quantity,
        date,
    }: ReservationInput): Promise<"Accepted" | "Rejected"> => {
        if (quantity <= restaurantCfg.tableSize) {
            await db.saveReservation({ quantity, date });
            return "Accepted";
        }
        return "Rejected";
    };
    // ... cancel, update, getReservations defined the same way ...
    return { reserve, cancel, update, getReservations };
};
```

`makeRestaurant` does not import `db` — it receives it as a parameter. This is
**Functional Dependency Injection**: dependencies are arguments, not imports. The
four operations are **methods on the `Restaurant`** rather than four separate
factories, because they are verbs that belong to one noun.

For the full name, history, FP connections (partial application, Reader monad),
the make-vs-compose rule, and known trade-offs of this pattern, see
[10-factory-function-pattern.md](./10-factory-function-pattern.md).

---

## 2. Barrel files — each module's public API

As a module grows beyond one file, a barrel (`index.ts`) controls what
the outside world can see. Internal implementation files stay private.

```ts
// src/restaurant/domain/index.ts  — domain barrel
export { default as makeRestaurant } from "./makeRestaurant.ts";
export type { Reservation, ReservationInput, RestaurantCfg, Restaurant, ... } from "./types.ts";

// src/restaurant/index.ts  — public barrel for the entire core layer
export * from "./domain/index.ts";
export * from "./ports/index.ts";
```

Callers import by name from the top-level core barrel:

```ts
import { makeRestaurant } from "./restaurant/index.ts";
import type { RestaurantCfg, DB, Logger, Metrics } from "./restaurant/index.ts";
```

You can restructure internals (rename a file, split a function) without
touching any code outside the module — only the barrel export changes.

With `moduleResolution: "NodeNext"` in tsconfig, you must include `/index.ts`
explicitly in import paths — Node.js ESM does not auto-resolve directories.

---

## 3. Composition — build the domain, wrap it per entry point

The domain is one factory — `makeRestaurant` — that builds the `Restaurant` port
from its driven ports (`db`, `logger`, `metrics`). Each entry point has a thin
**composition root** (`compose.ts`) that builds the restaurant and wraps it with
the one thing that differs: its **driving adapter** (an HTTP router vs. a CLI).

```ts
// src/server/compose.ts
const composeServerApp = ({ restaurantCfg, logger, metrics, db, port = 3000 }: ServerAppCfg) => {
    const restaurant = makeRestaurant({ db, logger, metrics, restaurantCfg });
    const router = makeRestaurantRouter({ restaurant });
    const app = makeRestaurantServer({ router, logger });

    const listen = (onReady) => app.listen(port, () => onReady(port));
    return { listen };
};
```

```ts
// src/cli/compose.ts
const composeCliApp = ({ restaurantCfg, logger, metrics, db }: CliAppCfg) => {
    const restaurant = makeRestaurant({ db, logger, metrics, restaurantCfg });
    const cli = makeRestaurantCli({ restaurant, tableSize: restaurantCfg.tableSize });

    return { cli };
};
```

Both entry points build the domain the same way (`makeRestaurant({ ... })`) and
differ only in their driving adapter: the server wraps it in an HTTP router and
exposes `listen`; the CLI wraps it in a CLI adapter and exposes `cli`. Change how
an operation behaves and you edit `makeRestaurant` **once** — both entry points
follow, because both depend only on the `Restaurant` port.

Each `compose*` returns exactly the capability its entry point drives — `{ listen }`
for the server, `{ cli }` for the CLI. (A `compose*` _can_ return a named bag of
several peers when an entry point needs more than one; here each needs just one.)
Integration tests skip the transport entirely and call `makeRestaurant`
directly for a `Restaurant` to exercise (see `tests/reservation.test.ts`). The
entry point (`index.ts`) owns all infrastructure decisions:

```ts
// src/server/index.ts  — infrastructure decisions live here
const logger = makeConsoleLogger();
const metrics = makeNoOpMetrics();
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

This keeps infrastructure decisions (which logger? which db?) at the outermost
layer, and domain wiring (how do the operations connect?) in the compose file.

---

## 4. Testing

Because every module receives its dependencies as arguments, testing is
straightforward — pass stubs or mocks, call the operation, check the result.

**Stubs** are plain objects used when the test does not care about the
interaction with that dependency:

```ts
// tests/reserve.test.ts
const stubDb: DB = {
    saveReservation: async (input) => ({ id: "stub-id", ...input }),
    getReservations: async () => [],
    cancelReservation: async () => true,
    updateReservation: async () => null,
};
const stubLogger: Logger = { info: () => {}, warn: () => {}, error: () => {} };
const stubMetrics: Metrics = { increment: () => {}, timing: () => {} };
```

**Mocks** use `vi.fn()` — only when the test needs to assert on the call
itself (was it called? with what arguments?):

```ts
it("calls db.saveReservation with the reservation on acceptance", async () => {
    const mockDb: DB = {
        ...stubDb,
        saveReservation: vi.fn(async (input) => ({ id: "mock-id", ...input })),
    };
    // Build the Restaurant and destructure the one operation under test.
    const { reserve } = makeRestaurant({
        db: mockDb,
        restaurantCfg: { tableSize: 10 },
        logger: stubLogger,
        metrics: stubMetrics,
    });

    await reserve({ quantity: 8, date: "12/12/12" });

    expect(mockDb.saveReservation).toHaveBeenCalledWith({
        quantity: 8,
        date: "12/12/12",
    });
});
```

The rule: use a stub when you need a valid dep to avoid errors; use a mock
when the test is specifically about _how_ the dep is used.

No test setup files, no global state, no class instantiation.
Each test creates exactly what it needs, nothing more.

---

## 5. Service lifetimes — when are services created?

In each compose function, every `make*` call runs exactly once — every
service is a **singleton within a single compose call**. Two calls to
`makeRestaurant()` produce two fully independent restaurants.

This is important for tests: each test that wires modules directly gets
a fresh `db` with an empty store.

```ts
// Each call creates a fresh in-memory store — tests never interfere
const r1 = makeRestaurant({
    restaurantCfg: { tableSize: 10 },
    logger,
    metrics,
    db: makeInMemoryDb({ logger, generateId: randomUUID }),
});
const r2 = makeRestaurant({
    restaurantCfg: { tableSize: 10 },
    logger,
    metrics,
    db: makeInMemoryDb({ logger, generateId: randomUUID }),
});
// r1 and r2 are completely isolated
```

Transient services (a new instance per use) and scoped services (one per
request) require a full IoC container (InversifyJS, tsyringe). Those add
decorators, reflection metadata, and runtime overhead. For most applications
the simple `make*` pattern is the right tool.

---

## 6. ES modules and imports

This project uses native ES modules (`"type": "module"` in `package.json`).
The JavaScript runtime caches modules — a module's top-level code runs
exactly once per process, and every subsequent import gets the cached exports.

```ts
// config.ts
console.log("config loaded"); // prints once, no matter how many files import this
export const config = { port: 3000, tableSize: 12 };
```

This is the **ES module singleton** — a process-wide singleton with no
container needed.

The reason infrastructure is created inside the entry point (not at module
scope) is test isolation: if `makeInMemoryDb()` were called at module scope
it would be shared across all tests in the process. Calling it inside each
test means each test call gets a fresh, empty store.

#### The `erasableSyntaxOnly` connection

`"erasableSyntaxOnly": true` in `tsconfig.json` means all TypeScript is
stripped at runtime without transformation — the output is plain ES module
JavaScript. That is why parameter properties (`constructor(private x: T)`)
and enums are banned: they generate code, not just types.
