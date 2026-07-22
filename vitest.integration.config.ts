import { loadEnvConfig } from "@next/env";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Vitest does not expose arbitrary .env keys on process.env by default. Load the
// same local environment files as the Next.js application before the suite's
// mandatory database-isolation guard runs.
loadEnvConfig(process.cwd());

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url))
    }
  },
  test: {
    globals: true,
    environment: "node",
    include: ["src/integration/**/*.integration.test.ts"],
    fileParallelism: false
  }
});
