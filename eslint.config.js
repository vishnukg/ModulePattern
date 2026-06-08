import js from "@eslint/js";
import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier";
import { defineConfig } from "eslint/config";

export default defineConfig(
    js.configs.recommended,
    tseslint.configs.recommended,
    prettier,
    {
        // Allow intentionally-unused args prefixed with "_". Express identifies
        // error middleware by its 4-arg arity, so the trailing `_next` must stay
        // even when unused; this matches the existing `_req` convention.
        rules: {
            "@typescript-eslint/no-unused-vars": [
                "error",
                { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
            ],
        },
    },
    {
        // Node scripts (scripts/*.mjs) run in Node — declare its globals so no-undef
        // (on for plain .js/.mjs; tseslint turns it off for .ts) doesn't flag them.
        files: ["**/*.mjs"],
        languageOptions: { globals: { process: "readonly", console: "readonly" } },
    },
);
