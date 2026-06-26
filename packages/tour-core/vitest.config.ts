import { defineConfig } from "vitest/config";

// tour-core's own test run. @balatro/competition-core resolves via the npm
// workspace symlink + its `exports` (→ src), no alias needed.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
