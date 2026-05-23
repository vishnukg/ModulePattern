# The Patterns in This Project

How the `make*` factory pattern, barrel files, and `compose.ts` fit together.

---

## 1. The `make*` factory pattern

Every operation in this project is built by a `make*` function:

```
make*(dependencies) → operation(runtimeArgs) → result
```

The `make*` function is called once during wiring (in `compose.ts`).
The returned operation is what's called at runtime — once per request.

```ts
// src/modules/restaurant/reserve.ts
const makeReserve = ({ db, restaurantCfg, logger, metrics }: ReserveCfg) => {
  const reserve = async ({ quantity, date }: ReservationInput): Promise<"Accepted" | "Rejected"> => {
    if (quantity <= restaurantCfg.tableSize) {
      await db.saveReservation({ quantity, date });
      return "Accepted";
    }
    return "Rejected";
  };
  return reserve;
};
```

`makeReserve` does not import `db` — it receives it as a parameter. This is
**Functional Dependency Injection**: dependencies are arguments, not imports.

---

## 2. Barrel files — each module's public API

As a module grows beyond one file, a barrel (`index.ts`) controls what
the outside world can see. Internal implementation files stay private.

```ts
// src/modules/restaurant/index.ts
export { default as makeReserve }    from "./reserve.ts";
export { default as makeCancel }     from "./makeCancel.ts";
export { default as makeUpdate }     from "./makeUpdate.ts";
export { default as makeRestaurant } from "./makeRestaurant.ts";
export type { Reservation, ReservationInput, RestaurantCfg, DB, ... } from "./types.ts";
```

Callers import by name from the barrel:

```ts
import { makeReserve, makeCancel, makeUpdate, makeRestaurant } from "./modules/restaurant/index.ts";
import type { RestaurantCfg, DB } from "./modules/restaurant/index.ts";
```

You can restructure internals (rename a file, split a function) without
touching any code outside the module — only the barrel export changes.

With `moduleResolution: "NodeNext"` in tsconfig, you must include `/index.ts`
explicitly in import paths — Node.js ESM does not auto-resolve directories.

---

## 3. How `compose.ts` wires everything

`compose.ts` is the **composition root** — the single place that knows
about all modules at once and wires them together.

```ts
// src/compose.ts
const makeApp = ({
  restaurantCfg,
  logger  = makeConsoleLogger(),
  metrics = makeNoOpMetrics(),
  db      = makeInMemoryDb({ logger }),
}: MakeAppCfg) => {
  const reserve    = makeReserve({ db, logger, metrics, restaurantCfg });
  const cancel     = makeCancel({ db, logger, metrics });
  const update     = makeUpdate({ db, logger, metrics, restaurantCfg });
  const restaurant = makeRestaurant({ reserve, cancel, update, getReservations: db.getReservations });

  return { restaurant };
};
```

Reading this:
1. `logger` — defaults to `makeConsoleLogger()` unless an override is passed (tests pass `silentLogger`)
2. `metrics` — defaults to `makeNoOpMetrics()` unless an override is passed
3. `db` — defaults to `makeInMemoryDb` unless an override is passed (production passes `makeDynamoDb`)
4. `reserve`, `cancel`, `update` — operations wired with all their dependencies
5. `restaurant` — assembles operations into the public domain API

Default parameters handle the "production vs test" switching cleanly.
No if-else chains, no environment checks inside business logic.

---

## 4. Testing

Because every module receives its dependencies as arguments, testing is
straightforward — pass stubs or mocks, call the operation, check the result.

**Stubs** are plain objects used when the test does not care about the
interaction with that dependency:

```ts
// tests/reserve.test.ts
const stubDb: DB = {
  saveReservation:   async (input) => ({ id: "stub-id", ...input }),
  getReservations:   async () => [],
  cancelReservation: async () => true,
  updateReservation: async () => null,
};
const stubLogger: Logger   = { info: () => {}, warn: () => {}, error: () => {} };
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
  const reserve = makeReserve({ db: mockDb, restaurantCfg: { tableSize: 10 }, logger: stubLogger, metrics: stubMetrics });

  await reserve({ quantity: 8, date: "12/12/12" });

  expect(mockDb.saveReservation).toHaveBeenCalledWith({ quantity: 8, date: "12/12/12" });
});
```

The rule: use a stub when you need a valid dep to avoid errors; use a mock
when the test is specifically about *how* the dep is used.

No test setup files, no global state, no class instantiation.
Each test creates exactly what it needs, nothing more.

---

## 5. Service lifetimes — when are services created?

In `compose.ts` each `make*` call runs exactly once — every service is
a **singleton within a single `makeApp()` call**. Two calls to `makeApp()`
produce two fully independent sets of services with no shared state.

This is important for tests: each test that calls `makeApp()` (or wires
modules directly) gets a fresh `db` with an empty store.

```ts
// Each call to makeApp gets a fresh in-memory store — tests never interfere
const { restaurant: r1 } = makeApp({ restaurantCfg: { tableSize: 10 } });
const { restaurant: r2 } = makeApp({ restaurantCfg: { tableSize: 10 } });
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

The reason `makeApp` uses default parameters rather than module-level
constants for logger/metrics/db is test isolation: if `makeInMemoryDb()`
were called at module scope it would be shared across all tests in the
process. Calling it inside `makeApp` means each test call gets a fresh one.

#### The `erasableSyntaxOnly` connection

`"erasableSyntaxOnly": true` in `tsconfig.json` means all TypeScript is
stripped at runtime without transformation — the output is plain ES module
JavaScript. That is why parameter properties (`constructor(private x: T)`)
and enums are banned: they generate code, not just types.
