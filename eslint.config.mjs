import { defineConfig, globalIgnores } from "eslint/config";

const eslintConfig = defineConfig([
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",   
    "next-env.d.ts",
  ]),
  {
    rules: {
      "no-unused-vars": "warn",
    },
  }
]);

export default eslintConfig;
