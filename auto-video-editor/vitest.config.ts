import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    setupFiles: ["tests/environment.ts"],
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
    testTimeout: 120000,
    hookTimeout: 120000,
  },
});
