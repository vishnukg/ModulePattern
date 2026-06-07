# Functional Programming Concepts

The five ideas you need before reading any of the code.

---

## 1. Functions as values

In TypeScript a function is just a value. You can store it in a variable,
pass it to another function, or return it from one.

```ts
// stored in a variable
const greet = (name: string) => `Hello, ${name}`;

// passed to another function
const runTwice = (fn: () => void) => {
    fn();
    fn();
};

// returned from a function  ← the key one for this project
const makeAdder = (x: number) => (y: number) => x + y;

const add5 = makeAdder(5);
add5(3); // 8
add5(10); // 15
```

`makeAdder(5)` returns a brand-new function that permanently remembers `5`.
That remembered value is called a **closure** (see section 3).

---

## 2. Pure functions

A **pure function** always returns the same output for the same input,
and causes no side effects (no network calls, no mutations, no logging).

```ts
// pure — same input always gives same output, nothing else happens
const add = (a: number, b: number) => a + b;

// impure — reads from outside, result can differ
const addToNow = (a: number) => a + Date.now();

// impure — mutates something outside the function
const items: number[] = [];
const push = (x: number) => items.push(x); // modifies `items`
```

Pure functions are easier to test because you don't need to set up any
external state — just call them and check the return value.

Most functions in this project are pure. `makeInMemoryDb` is the exception —
it mutates an array inside its closure (`store.push(reservation)`), which is
intentional (simulating a real database that persists writes).

---

## 3. Closures — how functions remember things

When a function is defined inside another function, it can read and write
the outer function's variables even after the outer function has finished.

```ts
const makeCounter = () => {
    let count = 0; // private — nothing outside can reach this

    return {
        increment: () => {
            count++;
        },
        value: () => count,
    };
};

const counter = makeCounter();
counter.increment();
counter.increment();
counter.value(); // 2

// count is completely hidden — counter.count doesn't exist
```

`count` lives in the closure of `makeCounter`. The returned object is the
only way to interact with it. This is **encapsulation without classes**.

`makeInMemoryDb` uses this exact pattern:

```ts
// src/restaurant/adapters/db/makeInMemoryDb.ts
const makeInMemoryDb = ({ logger }: InMemoryDbCfg): DB => {
    const store: Reservation[] = []; // private, lives in the closure

    const saveReservation = async (input: ReservationInput): Promise<Reservation> => {
        const reservation = { id: randomUUID(), ...input };
        store.push(reservation); // mutates the private store
        return reservation;
    };

    const getReservations = async (): Promise<Reservation[]> => [...store];

    return {
        saveReservation,
        getReservations,
        cancelReservation,
        updateReservation,
    };
};
```

Every time you call `makeInMemoryDb` you get a fresh, isolated `store` array.
Two calls to `makeInMemoryDb` never share state — critical for test isolation.

---

## 4. Immutability — never change, always create new

Functional programming avoids changing (mutating) existing values.
Instead of modifying something, you create a new version of it.

```ts
// mutable — changes the original
const arr = [1, 2, 3];
arr.push(4); // arr is now [1, 2, 3, 4]

// immutable — creates a new array, original untouched
const arr = [1, 2, 3];
const newArr = [...arr, 4]; // arr is still [1, 2, 3], newArr is [1, 2, 3, 4]
```

The same applies to objects:

```ts
const user = { name: "Alice", age: 30 };

// mutable — modifies user
user.age = 31;

// immutable — creates a new object
const updatedUser = { ...user, age: 31 };
```

The `...` is the **spread operator** — it copies all fields from the original
into a new object, then you override the fields you want to change.

`makeInMemoryDb` uses this for `getReservations` — it returns `[...store]`
(a copy) rather than the internal array, so callers cannot accidentally
mutate the database state.

---

## 5. Currying — outer function takes deps, inner function does work

**Currying** splits a function into multiple calls. In this project the
pattern is always:

```
make*(dependencies) → operation(runtimeArgs) → result
```

The outer `make*` call configures the function once (at startup).
The inner function is what's called at runtime (once per request).

```ts
// src/restaurant/domain/reservation/reserve.ts
const makeReserve = ({ db, restaurantCfg, logger, metrics }: ReserveCfg) => {
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
    return reserve;
};
```

`reserve` does not import `db` — it receives it as an argument. This means
in tests you can pass a fake `db` without touching real infrastructure.

`compose.ts` calls all the `make*` functions once at startup, wires the
results together, and hands them to the HTTP layer:

```ts
const reserve = makeReserve({ db, logger, metrics, restaurantCfg });
const cancel = makeCancel({ db, logger, metrics });
const update = makeUpdate({ db, logger, metrics, restaurantCfg });
const restaurant = makeRestaurant({
    reserve,
    cancel,
    update,
    getReservations: db.getReservations,
});
```
