# Going Deeper

The `this` bug, clean code structure, and how immutability stays fast.

---

## 1. The `this` binding bug — and why functional code cannot have it

In JavaScript, `this` inside a regular method does not refer to the object
it was defined on. It refers to whatever called the method at runtime.
This is one of the most common sources of bugs in class-based code.

```ts
class ReservationService {
  private tableSize: number;

  constructor(tableSize: number) {
    this.tableSize = tableSize;
  }

  reserve(quantity: number) {
    return quantity <= this.tableSize ? "Accepted" : "Rejected";
  }
}

const service = new ReservationService(10);
service.reserve(8); // "Accepted" — this = service ✓
```

The moment you separate the method from the object, `this` is lost:

```ts
const reserve = service.reserve;
reserve(8); // TypeError: Cannot read properties of undefined (reading 'tableSize')
            // this = undefined in strict mode
```

This is not a contrived example. It happens constantly in real code:

```ts
setTimeout(service.reserve, 1000);   // this is lost
[8, 12, 15].map(service.reserve);    // this is lost
const { reserve } = service;
reserve(8);                          // this is lost
```

#### The common fixes — all workarounds

**`.bind()`**
```ts
const reserve = service.reserve.bind(service);
reserve(8); // works — but you must remember to call .bind() everywhere
```

**Arrow function class field** — captures `this` at construction time:
```ts
class ReservationService {
  reserve = (quantity: number) => { // arrow, not a method
    return quantity <= this.tableSize ? "Accepted" : "Rejected";
  };
}
```
Works, but creates a new function object per instance instead of sharing
one on the prototype — costs more memory at scale.

**Wrapper at the call site:**
```ts
setTimeout(() => service.reserve(8), 1000); // works but adds noise everywhere
```

All three fix a problem that should not exist in the first place.

#### Why functional code cannot have this bug

In the functional pattern there is no `this`. Dependencies live in a closure.
The function is a standalone value that carries everything it needs.

```ts
// after server/compose.ts wires it up:
const { reserve } = restaurant;

await reserve({ quantity: 8, date: "2024-12-12" }); // ✓
setTimeout(reserve, 1000);                           // ✓
[r1, r2, r3].map(reserve);                          // ✓
const fn = reserve;
await fn({ quantity: 8, date: "2024-12-12" });       // ✓
```

Every one of these works because `reserve` does not need any surrounding
context. `restaurantCfg`, `db`, `logger`, and `metrics` are sealed into the
closure — they travel with the function wherever it goes.

---

## 2. Clean code structure in this functional style

#### One `make*` function per file

Each file exports a single default `make*` function.
The filename is the function name (minus the `make` prefix for ops,
full name for factories).

```
src/core/
  index.ts                ← public barrel (re-exports everything below)
  domain/restaurant/
    reservation/          ← all reservation operations grouped here
      reserve.ts            ← makeReserve
      makeCancel.ts         ← makeCancel
      makeUpdate.ts         ← makeUpdate
      index.ts              ← reservation barrel
    makeRestaurant.ts     ← makeRestaurant
    types.ts              ← Reservation, DB, Restaurant, RestaurantCfg, ...
    index.ts              ← restaurant barrel (re-exports reservation + types)
  ports/
    logger.ts             ← Logger interface
    metrics.ts            ← Metrics, FakeMetrics interfaces
    index.ts              ← ports barrel (type-only re-exports)

src/adapters/
  db/
    makeInMemoryDb.ts
    makeDynamoDb.ts
  logger/
    consoleLogger.ts
  metrics/
    makeNoOpMetrics.ts
  http/
    makeRestaurantRouter.ts
```

If you want to find `makeCancel`, open `makeCancel.ts`. Never any ambiguity.

Test helpers live outside `src/` — they are not part of the application:

```
tests/helpers/
  fakeMetrics.ts    ← makeFakeMetrics (returns FakeMetrics)
  silentLogger.ts   ← makeSilentLogger (returns Logger)
```

#### Types co-located with their module

Types live in a `types.ts` file next to the code that owns them.

```
src/core/domain/restaurant/types.ts   ← Reservation, DB, Restaurant, and all domain types
src/core/ports/logger.ts              ← Logger interface
src/core/ports/metrics.ts             ← Metrics, FakeMetrics interfaces
```

`domain/restaurant/types.ts` owns the `DB` interface because the domain defines
what a database *must* be able to do — it's a port the domain controls.
Adapters (`adapters/db/`) import from `domain/restaurant/types.ts` to satisfy it.

`Logger` and `Metrics` live in `ports/` rather than in `domain/restaurant/types.ts`
because they are cross-cutting — used by the domain and by adapters alike
(e.g. `makeInMemoryDb` logs). They are not restaurant-specific concepts.

Single-use cfg types (`InMemoryDbCfg`, `DynamoDbCfg`, `ServerAppCfg`) are
defined inline at the top of the file that uses them — no separate types file
needed when there is only one consumer.

#### Barrel files for controlled public APIs

Each `index.ts` uses named re-exports to expose only what the module wants
to share:

```ts
// src/core/index.ts  — the only import path callers need
export * from "./domain/restaurant/index.ts";
export * from "./ports/index.ts";
```

Callers import everything by name from one place — internal file structure is hidden:

```ts
import { makeReserve, makeCancel }      from "../core/index.ts";
import type { DB, Logger, Metrics }     from "../core/index.ts";
```

#### Layers never import across boundaries

All dependencies flow through the composition roots. Domain code never imports adapters.

```
          server/compose.ts   cli/compose.ts
              /     |      \         |
         adapters/  ports/   domain/restaurant
```

`reserve.ts` does not import `makeInMemoryDb`. It receives `db` as an
argument. This means you can test `reserve` without any DB implementation
existing at all.

#### Adding a new operation — the exact steps

Example: adding email confirmation when a reservation is accepted.

1. Add an `Email` port interface to `src/core/ports/email.ts`
2. Create `src/adapters/email/makeNodemailerEmail.ts` — one `make*` function implementing the port
3. Update `ReserveCfg` in `domain/restaurant/types.ts` if `reserve` needs it
4. Wire it in the relevant compose files: `const email = makeNodemailerEmail({ ... })`

The pattern is identical every time. No new concepts needed.

---

## 3. Immutability without performance hits

The concern: "if we never mutate and always create new objects, are we
copying large amounts of data on every operation?"

The answer is no — because **spread copies references, not values**.

#### References vs values

In JavaScript, objects are accessed via references — just a memory address,
8 bytes on a 64-bit system. When you spread an object, you copy its
references, not its data.

```ts
const address = { city: "London", postcode: "SW1A" }; // lives somewhere in memory

const user = { name: "Alice", address };  // address field = 8-byte pointer
                                          // NOT a copy of the address object

const updatedUser = { ...user, name: "Bob" };
// updatedUser.address === user.address  ← same reference
// only `name` is new — address was not touched
```

Spreading `user`: 2 reference copies = 16 bytes. The address object itself
was not moved or copied.

#### Structural sharing

The reason shallow copies are cheap is called **structural sharing**:
when you create a new version of an object, unchanged parts are shared
between the old and new version rather than copied.

```ts
const v1 = { a: bigObject, b: bigObject, c: bigObject };
const v2 = { ...v1, c: differentObject };

// v2.a === v1.a  ← shared, not copied
// v2.b === v1.b  ← shared, not copied
// v2.c           ← only this reference changed
```

`bigObject` could be 100MB and the spread still only costs 3 pointer copies.

#### When immutability does cost something

**Hot loops** — creating new arrays on every iteration of a tight loop:
```ts
// expensive — new array every iteration
const result = items.reduce((acc, x) => [...acc, transform(x)], []);

// better — allocates once
const result = items.map(transform);
```

**Deeply nested objects** — updating a value deep in a nested structure
requires copying every level on the path:
```ts
const updated = {
  ...state,
  deep: { ...state.deep, nested: { ...state.deep.nested, value: newValue } },
};
```

For this case, **Immer** gives you structural sharing automatically —
you write mutating code, Immer produces an immutable result using a
proxy that only copies what changed.

Neither case applies to this project. Wiring in the compose files happens
once at startup. At runtime, `reserve` returns a plain string — nothing is
spread at all.
