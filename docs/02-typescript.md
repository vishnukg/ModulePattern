# TypeScript Fundamentals

The TypeScript features used in this project, explained from scratch.

---

## 1. Type annotations

TypeScript adds types on top of JavaScript. They are stripped at runtime —
they exist only to catch mistakes at compile time.

```ts
const age: number = 25;
const greet = (name: string): string => `Hi ${name}`;

type User = { name: string; age: number };
const user: User = { name: "Alice", age: 30 };
```

When TypeScript can figure out the type from context, you don't need to
write it — this is called **type inference**:

```ts
const x = 5; // TypeScript infers: number
const y = "hello"; // TypeScript infers: string
```

---

## 2. `type` vs `interface`

Both describe the shape of an object.

```ts
type Reservation = { id: string; quantity: number; date: string };

interface Logger {
    info: (message: string, data?: Record<string, unknown>) => void;
}
```

In this project:

- `type` is used for data shapes (`Reservation`, `ReservationInput`, `RestaurantCfg`, config objects)
- `interface` is used when multiple implementations are expected (`Logger`, `Metrics`, `FakeMetrics`)

`import type` imports a type without including any runtime code:

```ts
import type { Reservation } from "./types.ts";
```

---

## 3. Generics — one function that works with any type

A **generic** is a type placeholder written as `<T>`. It lets you write
one function that works with many types while TypeScript still checks each use.

```ts
// without generics — only works for string[]
const first = (arr: string[]): string => arr[0]!;

// with generics — works for any array
function first<T>(arr: T[]): T {
    return arr[0]!;
}

first([1, 2, 3]); // TypeScript infers T = number, returns number
first(["a", "b", "c"]); // TypeScript infers T = string, returns string
```

You almost never need to write the type explicitly — TypeScript infers it
from what you pass in.

In this project generics appear in the `DB` interface — `Promise<T>` means
"an async operation that resolves to `T`":

```ts
// src/restaurant/ports/db.ts
export type DB = {
    saveReservation: (input: ReservationInput) => Promise<Reservation>;
    getReservations: () => Promise<Reservation[]>;
    cancelReservation: (id: string) => Promise<boolean>;
    updateReservation: (id: string, input: ReservationInput) => Promise<Reservation | null>;
};
```

`Promise<Reservation>` means "resolves to a `Reservation`".
`Promise<Reservation | null>` means "resolves to either a `Reservation` or `null`".

---

## 4. Union types — `A | B`

The `|` operator means "one of these types". TypeScript forces you to
handle every possibility before you can use the value.

```ts
type Result = "Accepted" | "Rejected";

const handle = (result: Result) => {
    if (result === "Accepted") {
        /* ... */
    }
    if (result === "Rejected") {
        /* ... */
    }
};
```

This project uses union types as domain return values — `reserve` returns
`"Accepted" | "Rejected"`, `cancel` returns `"Cancelled" | "NotFound"`, and so on.
Using string literals instead of booleans makes code self-documenting and
exhaustive — TypeScript will warn if you forget a case.

---

## 5. `Record<K, V>` — a typed object

`Record<K, V>` is a built-in TypeScript type that describes an object
with keys of type `K` and values of type `V`.

```ts
type Scores = Record<string, number>;
const scores: Scores = { alice: 95, bob: 88 }; // ✓
```

This project uses `Record` in the `Logger` interface and in `fakeMetrics`:

```ts
// Logger methods accept optional metadata as Record<string, unknown>
info: (message: string, data?: Record<string, unknown>) => void;

// fakeMetrics stores counters as Record<string, number>
const counters: Record<string, number> = {};
```

---

## 6. Intersection types — `A & B`

The `&` operator merges two types into one that has all fields of both.

```ts
type A = { name: string };
type B = { age: number };
type C = A & B; // { name: string; age: number }
```

This project uses intersection via `{ id: string, ...input }` — the
`Reservation` type has an `id` field on top of `ReservationInput`:

```ts
type ReservationInput = { quantity: number; date: string };
type Reservation = { id: string; quantity: number; date: string };

// In makeInMemoryDb:
const reservation: Reservation = { id: randomUUID(), ...input };
//                                  ^^^^^^^^^^^^^^^^^^^^^^^^^
//                                  merges id with all input fields
```

---

## 7. `interface` extension

One interface can extend another to inherit all its methods and add more.

```ts
interface Metrics {
    increment: (name: string) => void;
    timing: (name: string, durationMs: number) => void;
}

interface FakeMetrics extends Metrics {
    // inherits increment and timing, adds:
    getCounter: (name: string) => number;
    getTimings: (name: string) => number[];
}
```

`FakeMetrics` satisfies the `Metrics` contract — you can pass it anywhere
`Metrics` is expected. This is how test doubles work in this project.

`makeFakeMetrics` (in `tests/helpers/fakeMetrics.ts`) returns a `FakeMetrics`.
The production code receives it typed as `Metrics` — it has no idea the
test double is storing counters internally.

---

## 8. Object literal shorthand and destructuring

JavaScript has shorthand syntax for creating objects when the property name
is the same as the variable name.

```ts
const restaurant = makeRestaurant({
    reserve,
    cancel,
    update,
    getReservations,
});

return { restaurant };
```

This:

```ts
return { restaurant };
```

is the same as writing:

```ts
return {
    restaurant: restaurant,
};
```

The first `restaurant` is the object property name. The second `restaurant`
is the variable value being assigned to that property.

The caller can then use **object destructuring**:

```ts
const { cli } = composeCliApp({
    restaurantCfg: { tableSize: seats },
    logger,
    metrics,
    db,
});
```

That is shorthand for:

```ts
const app = composeCliApp({
    restaurantCfg: { tableSize: seats },
    logger,
    metrics,
    db,
});

const cli = app.cli;
```

This pattern appears in the composition roots:

```ts
// src/cli/compose.ts
return { cli };

// src/cli/index.ts
const { cli } = composeCliApp(...);
```

The outer object lets a composition function return named app capabilities. Each
composition root returns exactly the one its entry point drives, so the caller
destructures that single capability:

```ts
// src/server/compose.ts
return { listen };

// entry point
const { listen } = composeServerApp(...);
listen();
```

Integration tests don't go through the server at all — they call
`composeRestaurant` directly, which returns the `Restaurant` port (captured
directly, no destructuring needed):

```ts
const restaurant = composeRestaurant({ db, logger, metrics, restaurantCfg });
await restaurant.reserve({ quantity: 2, date: "2024-12-01" });
```
