import { defineConfig } from "vitest/config";

// match-core's own test run (the root config only globs the league's src/).
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
