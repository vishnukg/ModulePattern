# 08 — TypeScript Module Resolution

This project uses `"moduleResolution": "bundler"`. This doc explains what that
means, why it was chosen, what the alternatives are, and when each one is correct.

---

## The problem module resolution solves

When TypeScript sees this import:

```ts
import { makeReserve } from "./modules/restaurant";
```

It needs to figure out which file that refers to. Is it:
- `./modules/restaurant.ts`?
- `./modules/restaurant/index.ts`?
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
import { makeReserve } from "./modules/restaurant/index.ts";

// ✗ — TypeScript error: directory imports not allowed
import { makeReserve } from "./modules/restaurant";

// ✗ — TypeScript error: extension required
import { makeReserve } from "./modules/restaurant/index";
```

Use this when: your code runs directly in Node.js as native ESM
(i.e. `node server.js` with `"type": "module"` and no build step).

### `"moduleResolution": "bundler"` — bundler / tsx mode

This matches how bundlers (Vite, esbuild, webpack) and tools like `tsx` resolve
modules. These tools relax Node's strict rules because they handle resolution
themselves at build or run time.

```ts
// ✓ — directory import resolves to index.ts
import { makeReserve } from "./modules/restaurant";

// ✓ — explicit path still works
import { makeReserve } from "./modules/restaurant/index.ts";

// ✓ — extension optional
import { makeReserve } from "./modules/restaurant/reserve";
```

Use this when: you use `tsx`, `ts-node`, Vite, esbuild, or any bundler to
run or build your code. This is the correct setting for most modern TypeScript
projects that are not publishing raw Node.js ESM packages.

### `"moduleResolution": "node"` — legacy CommonJS (avoid)

The original Node.js module resolution, designed for CommonJS (`require()`).
Does directory imports and optional extensions, but does not understand ESM.
Avoid for new projects — it misses many modern TypeScript checks.

---

## Why this project uses `"bundler"`

This project is run with `tsx`:

```bash
tsx src/server.ts
tsx src/cli.ts
```

`tsx` is a TypeScript execution tool built on esbuild. It handles module
resolution itself — it is not Node.js native ESM. Using `"nodenext"` would
enforce rules that `tsx` doesn't require and would give misleading errors
(or require workarounds like `allowImportingTsExtensions`).

`"bundler"` is the setting the TypeScript team recommends for exactly this
scenario: TypeScript projects that use a bundler or bundler-like tool rather
than shipping raw `.js` files to Node.js.

One flag that stays required even in `bundler` mode: `"allowImportingTsExtensions": true`.
This project's imports still use explicit `.ts` extensions
(e.g. `from "../restaurant/types.ts"`). Without this flag, `tsc --noEmit`
rejects them. The flag tells TypeScript: "I know these files end in `.ts` —
the bundler handles the resolution, not Node directly."

---

## What `"module": "Preserve"` means

`module` controls how TypeScript emits import/export syntax in compiled output.
Since this project uses `"noEmit": true` (TypeScript only type-checks; tsx does
the actual execution), the `module` setting has almost no practical effect here.

`"Preserve"` means: emit the import syntax exactly as written — don't transform
`import` to `require()` or vice versa. It's the right default when a bundler
or tool handles the output.

The previous setting was `"NodeNext"`, which implied `moduleResolution: "nodenext"`
and required explicit `.ts` extensions everywhere. Changing to
`"module": "Preserve"` + `"moduleResolution": "bundler"` correctly reflects the
actual runtime.

---

## Summary

| Setting            | Use when                                 | Directory imports | Optional extensions |
|--------------------|------------------------------------------|:-----------------:|:-------------------:|
| `nodenext`         | Running raw Node.js native ESM           | ✗                 | ✗                   |
| `bundler`          | Using tsx, Vite, esbuild, or any bundler | ✓                 | ✓                   |
| `node` (legacy)    | Old CommonJS projects                    | ✓                 | ✓                   |

**Is it advised?**

Yes — for a project running with `tsx`, `"bundler"` is the *correct* setting, not
a shortcut. Using `"nodenext"` with `tsx` was technically incorrect: it was
enforcing Node.js native ESM rules on a tool that doesn't follow them. The switch
to `"bundler"` makes the TypeScript configuration accurately describe how the
project actually runs.

If this project were ever refactored to run as native Node.js ESM without tsx
(e.g. compiling to `.js` with `tsc` and running `node server.js`), the correct
setting would switch back to `"nodenext"`.
