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
const x = 5;        // TypeScript infers: number
const y = "hello";  // TypeScript infers: string
```

---

## 2. `type` vs `interface`

Both describe the shape of an object.

```ts
type Reservation = { quantity: number; date: string };

interface Logger {
  info: (message: string) => void;
}
```

In this project:
- `type` is used for data shapes (`Reservation`, `RestaurantCfg`, config objects)
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
function first<T>(arr: T[]): T { return arr[0]!; }

first([1, 2, 3]);        // TypeScript infers T = number, returns number
first(["a", "b", "c"]); // TypeScript infers T = string, returns string
```

You almost never need to write the type explicitly — TypeScript infers it
from what you pass in.

The container uses three generics at once: `T`, `K`, and `V`:

```ts
add<K extends string, V>(name: K, factory: (services: T) => V)
// T = services registered so far (comes from Container<T>)
// K = name of the new service (inferred from the string you pass)
// V = type of the new service (inferred from what your factory returns)
```

---

## 4. Generic constraints — `extends`

`K extends string` means "K must be a subtype of string".
Without it, someone could pass a number as a key, which would break things.

```ts
function getProperty<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key];
}

const user = { name: "Alice", age: 30 };
getProperty(user, "name"); // ✓ — "name" is a key of user
getProperty(user, "foo");  // ✗ — compile error: "foo" is not a key of user
```

In the container, `K extends string` ensures service names are always
strings, which is required for object keys.

---

## 5. `Record<K, V>` — a typed object

`Record<K, V>` is a built-in TypeScript type that describes an object
with keys of type `K` and values of type `V`.

```ts
type Scores = Record<string, number>;
const scores: Scores = { alice: 95, bob: 88 }; // ✓

// with a literal key — TypeScript knows the exact key name
type SaveFn = Record<"saveReservation", (r: Reservation) => void>;
// equivalent to: { saveReservation: (r: Reservation) => void }
```

The container return type uses `Record<K, V>` to represent the newly
added service, then merges it into the existing type with `&`.

---

## 6. Intersection types — `A & B`

The `&` operator merges two types into one that has all fields of both.

```ts
type A = { name: string };
type B = { age: number };
type C = A & B; // { name: string; age: number }
```

The container's `.add()` return type is `Container<T & Record<K, V>>`:
the old services `T` merged with the new service `Record<K, V>`.
TypeScript tracks this growing type across every `.add()` call.

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
