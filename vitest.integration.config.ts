import { loadEnvConfig } from "@next/env";
import { defineConfig } from "vitest/config";

// Vitest does not expose arbitrary .env keys on process.env by default. Load the
// same local environment files as the Next.js application before the suite's
// mandatory database-isolation guard runs.
loadEnvConfig(process.cwd());

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/integration/**/*.integration.test.ts"],
    fileParallelism: false
  }
});
