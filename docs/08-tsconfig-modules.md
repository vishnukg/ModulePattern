# 08 — TypeScript Module Resolution

This project uses `"module": "NodeNext"` (which implies `"moduleResolution": "nodenext"`).
This doc explains what that means, why it was chosen, what the alternatives are,
and when each one is correct.

---

## The problem module resolution solves

When TypeScript sees this import:

```ts
import { makeReserve } from "./domain";
```

It needs to figure out which file that refers to. Is it:

- `./domain.ts`?
- `./domain/index.ts`?
- Something else?

The answer depends on which **module resolution strategy** is configured.
Different strategies follow different rules, matching different runtimes and tools.

---

## The three strategies you'll encounter

### `"moduleResolution": "node16"` / `"nodenext"` — strict Node.js ESM

This matches Node.js native ESM exactly. Node's rule is: **no guessing**.
Every import must specify the exact path the runtime will find.

```ts
// ✓ — explicit path, explicit extension
import { makeReserve } from "./domain/index.ts";

// ✗ — TypeScript error: directory imports not allowed
import { makeReserve } from "./domain";

// ✗ — TypeScript error: extension required
import { makeReserve } from "./domain/index";
```

Use this when: your code runs directly in Node.js as native ESM
(i.e. `node server.js` with `"type": "module"` and no build step).

### `"moduleResolution": "bundler"` — bundler / tsx mode

This matches how bundlers (Vite, esbuild, webpack) and tools like `tsx` resolve
modules. These tools relax Node's strict rules because they handle resolution
themselves at build or run time.

```ts
// ✓ — directory import resolves to index.ts
import { makeReserve } from "./domain";

// ✓ — explicit path still works
import { makeReserve } from "./domain/index.ts";

// ✓ — extension optional
import { makeReserve } from "./domain/reserve";
```

Use this when: you use `tsx`, `ts-node`, Vite, esbuild, or any bundler to
run or build your code. This is the correct setting for most modern TypeScript
projects that are not publishing raw Node.js ESM packages.

### `"moduleResolution": "node"` — legacy CommonJS (avoid)

The original Node.js module resolution, designed for CommonJS (`require()`).
Does directory imports and optional extensions, but does not understand ESM.
Avoid for new projects — it misses many modern TypeScript checks.

---

## Why this project uses `"nodenext"`

This project runs TypeScript files directly with native Node.js (Node.js 22+):

```bash
node src/server/index.ts
node src/cli/index.ts
```

Node.js native ESM has strict module resolution rules — no directory imports,
extensions required. `"nodenext"` makes TypeScript enforce exactly those rules,
so imports that pass `tsc --noEmit` are guaranteed to work at runtime too.

One extra flag required: `"allowImportingTsExtensions": true`.
Since we run `.ts` files directly (no compilation step), import paths use `.ts`
extensions (e.g. `from "../domain/types.ts"`). Without this flag,
`tsc --noEmit` rejects them because normally TypeScript emits `.js` files and
`.ts` import extensions would be wrong in the output. With `"noEmit": true`
there is no output, so the flag is safe to enable.

All imports in this project therefore look like:

```ts
import { makeReserve } from "../domain/index.ts"; // ✓
import { makeReserve } from "../domain"; // ✗ — directory import forbidden
```

---

## Summary

| Setting         | Use when                                 | Directory imports | Optional extensions |
| --------------- | ---------------------------------------- | :---------------: | :-----------------: |
| `nodenext`      | Running raw Node.js native ESM           |         ✗         |          ✗          |
| `bundler`       | Using tsx, Vite, esbuild, or any bundler |         ✓         |          ✓          |
| `node` (legacy) | Old CommonJS projects                    |         ✓         |          ✓          |

**Is it advised?**

Yes — for a project running with native Node.js, `"nodenext"` is the _correct_
setting. It makes the TypeScript configuration accurately describe how the
project actually runs. If you later switch to `tsx` or Vite, the right move is
to switch to `"bundler"` — not `"nodenext"` — because those tools handle
resolution themselves and don't follow Node's strict rules.
