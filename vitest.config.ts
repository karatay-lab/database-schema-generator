import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";
import path from "path";

export default defineConfig({
  plugins: [tsconfigPaths()],
  resolve: {
    alias: {
      "server-only": path.resolve("./src/test/mocks/server-only.ts"),
      "client-only": path.resolve("./src/test/mocks/server-only.ts"),
    },
  },
  test: {
    environment: "node",
    globals: true,
    env: {
      TEST_DB_PATH: ":memory:",
    },
    pool: "forks",
  },
});
