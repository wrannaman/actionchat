import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    // Long timeouts for real LLM/MCP calls
    testTimeout: 120_000,
    hookTimeout: 120_000,

    // Setup file to validate env vars
    setupFiles: ["./tests/setup/env.ts"],

    // Run integration tests serially to avoid shared external-state issues
    pool: "threads",
    maxThreads: 1,
    minThreads: 1,

    // Include .ts and .js test files
    include: ["tests/**/*.test.{ts,js}"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
