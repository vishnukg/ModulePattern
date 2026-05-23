import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    rules: {
      // container.ts uses `as any` intentionally — internal cast, public types stay correct
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
);
