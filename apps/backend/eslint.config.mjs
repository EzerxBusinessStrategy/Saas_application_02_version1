import tseslint from "typescript-eslint";

export default [
  { ignores: ["dist/**", "coverage/**"] },
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.ts", "test/**/*.ts", "vitest.config.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    },
  },
];
