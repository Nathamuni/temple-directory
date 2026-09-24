import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // Each file gets a fresh module graph, so DATA_DIR can point at its own temp dir.
    isolate: true,
    pool: "forks",
  },
});
