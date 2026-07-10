import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/integration/**/*.integration.test.ts"],
    fileParallelism: false
  }
});
