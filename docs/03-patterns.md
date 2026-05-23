# The Patterns in This Project

How the module pattern, container, and compose fit together.

---

## 1. The module pattern

Each module is a file that exports a single curried function:

```
outer(dependencies) → inner(runtimeArgs) → result
```

The outer function is called once during wiring (in `compose.ts`).
The inner function is what's used at runtime.

```ts
// src/modules/restaurant/reserve.ts
export default ({ db, restaurantCfg, logger, metrics }: ReserveCfg) =>
  ({ quantity, date }: Reservation) => {
    // business logic here
  };
```

Each module barrel (`index.ts`) collects the functions in a namespace:

```ts
// src/modules/restaurant/index.ts
import reserve from "./reserve.ts";
export default { reserve };

// src/modules/index.ts
import restaurant from "./restaurant/index.ts";
import db from "./db/index.ts";
import logger from "./logger/index.ts";
import metrics from "./metrics/index.ts";
export default { restaurant, db, logger, metrics };
```

`compose.ts` then accesses everything through `modules.restaurant.reserve`,
`modules.db.saveReservation`, etc. — no long import chains.

---

## 2. The container pattern

`src/container.ts` is a small builder that wires modules together.

```ts
type Container<T> = {
  add<K extends string, V>(
    name: K,
    factory: (services: T) => V
  ): Container<T & Record<K, V>>;
  build(): T;
};
```

The factory receives all services registered so far (`T`) and returns the
new service (`V`). TypeScript grows `T` with each `.add()` call — if you
try to use a service before registering it, you get a compile error.

```ts
function make<T>(services: T): Container<T> {
  return {
    add(name, factory) {
      const newService = factory(services);
      // `as any` lets TypeScript spread a generic object — Container<T>
      // still enforces correctness for callers.
      const next = { ...(services as any), [name]: newService };
      return make(next) as any;
    },
    build() {
      return services;
    },
  };
}
```

Key points:
- `make` calls itself recursively, each time with a bigger `services` object
- Each call creates a **new** object — nothing is ever mutated
- `services` lives in a closure, carrying the accumulated state forward
- The `as any` casts are a TypeScript limitation; the public type is correct

---

## 3. How `compose.ts` wires everything

`compose.ts` is the only place that knows about all modules at once.

```ts
export default ({ restaurantCfg, logger: loggerOverride, metrics: metricsOverride }: ComposeCfg) =>
  container()
    .add("logger",          () => loggerOverride  ?? modules.logger.consoleLogger())
    .add("metrics",         () => metricsOverride ?? modules.metrics.fakeMetrics())
    .add("saveReservation", ({ logger }) => modules.db.saveReservation({ logger }))
    .add("db",              ({ saveReservation }) => ({ saveReservation }))
    .add("reserve",         ({ db, logger, metrics }) => modules.restaurant.reserve({ db, logger, metrics, restaurantCfg }))
    .add("restaurant",      ({ reserve }) => ({ reserve }))
    .build();
```

Reading each line:
1. `logger` — defaults to `consoleLogger` unless an override is passed (tests pass `silentLogger`)
2. `metrics` — defaults to `fakeMetrics` unless an override is passed
3. `saveReservation` — outer function called with `{ logger }`, inner function stored
4. `db` — wraps `saveReservation` into a `{ db }` namespace (matches what `reserve` expects)
5. `reserve` — outer function called with all deps, inner function stored
6. `restaurant` — wraps `reserve` into the public API shape

The result has all services. The caller destructures only what it needs:
```ts
const { restaurant } = compose({ restaurantCfg: { tableSize: 12 } });
```

---

## 4. Testing

Because every module receives its dependencies as arguments, testing is
straightforward — pass fakes, call the inner function, check the result.

```ts
import reserve from "../src/modules/restaurant/reserve.ts";

it("accepts when quantity is within table size", () => {
  const fakeDb = { saveReservation: vi.fn() };
  const fakeLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
  const fakeMetrics = { increment: vi.fn(), timing: vi.fn() };

  const doReserve = reserve({
    db: fakeDb,
    restaurantCfg: { tableSize: 10 },
    logger: fakeLogger,
    metrics: fakeMetrics,
  });

  expect(doReserve({ quantity: 8, date: "2024-12-12" })).toBe("Accepted");
  expect(fakeDb.saveReservation).toHaveBeenCalledOnce();
});
```

No test setup files, no mocking frameworks, no class instantiation.
The pattern itself makes testing cheap.

---

## 5. Service lifetimes — singleton, transient, scoped

In a full IoC container, every registered service has a **lifetime** that
controls when it gets created and how long it lives.

**Singleton** — created once, shared by everything that needs it.

```ts
// created once when compose() runs, shared across all uses
.add("db", () => createDatabaseConnection())
```

**Transient** — created fresh every time it is requested.

```ts
// hypothetical: a new logger instance per injection point
.add("logger", () => createLogger(), "transient")
```

**Scoped** — created once per scope (e.g., one HTTP request), isolated
from other concurrent scopes.

```
Request A → scope created → db connection A → request ends → connection closed
Request B → scope created → db connection B → request ends → connection closed
```

**What our container supports**: only singleton within a single `compose()` call.
Every `.add()` runs its factory exactly once. Two calls to `compose()` produce
two fully independent sets of services with no shared state.

Transient and scoped lifetimes require a more complex system — a `.resolve()`
method called at runtime, scope tokens, and teardown hooks. Full IoC containers
(InversifyJS, tsyringe) add all of that at the cost of decorators, reflection,
and a runtime dependency.

---

## 6. ES modules and service lifetimes

An **ES module** is any file that uses `import` or `export`. The JavaScript
runtime caches modules — a module's top-level code runs exactly once per
process, and every subsequent import gets the cached exports.

```ts
// config.ts
console.log("config loaded"); // prints once, no matter how many files import this
export const config = { port: 3000, tableSize: 12 };
```

This is the **ES module singleton** — a process-wide singleton backed by the
runtime, with no container needed.

#### ESM singleton vs container singleton

| | ES module singleton | Container singleton |
|---|---|---|
| Scope | Process-wide | Per `compose()` call |
| Tests | Shared across all tests in a process | Each `compose()` call gets fresh services |
| Good for | Constants, config, read-only values | Stateful services (db connections, caches) |

The test file shows why container singletons matter for testing — each
`compose()` call creates a fresh `reservations[]` closure. ESM singletons
would share state across tests and cause interference.

#### ESM for transient — export a factory

```ts
export const createLogger = (name: string) => ({
  log: (msg: string) => console.log(`[${name}] ${msg}`),
});

// each caller gets its own logger instance
const logger = createLogger("restaurant");
```

#### The `erasableSyntaxOnly` connection

`"erasableSyntaxOnly": true` in `tsconfig.json` means all TypeScript is
stripped at runtime without transformation — the output is plain ES module
JavaScript. That is why parameter properties (`constructor(private x: T)`)
are banned: they generate code, not just types.
