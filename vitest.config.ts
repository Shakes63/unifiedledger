import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    // Test environment
    environment: "jsdom",
    globals: true,

    // Setup files
    setupFiles: ["./test-setup.ts"],

    // Include and exclude patterns
    include: ["**/__tests__/**/*.{test,spec}.{ts,tsx}"],
    exclude: ["node_modules", ".next", ".turbo"],

    // Coverage configuration
    coverage: {
      // Provider
      provider: "v8",
      reporter: ["text", "json", "html", "lcov"],
      reportOnFailure: true,

      // Coverage thresholds
      lines: 80,
      functions: 80,
      branches: 75,
      statements: 80,

      // Exclude patterns
      exclude: [
        "node_modules/",
        "test-setup.ts",
        "**/*.d.ts",
        "**/__tests__/**",
        "**/dist/**",
        "*.config.ts",
      ],

      // Include patterns for specific high-priority files
      thresholds: {
        // Financial calculations - 100% required
        "lib/transactions/split-calculator.ts": { lines: 100, functions: 100 },
        "lib/tax/*.ts": { lines: 100, functions: 100 },
        "lib/sales-tax/*.ts": { lines: 100, functions: 100 },

        // Matching algorithms - 95% required
        "lib/rules/condition-evaluator.ts": { lines: 95, functions: 95 },
        "lib/rules/rule-matcher.ts": { lines: 95, functions: 95 },
        "lib/bills/bill-matcher.ts": { lines: 95, functions: 95 },
        "lib/duplicate-detection.ts": { lines: 95, functions: 95 },

        // Data processing - 90% required
        "lib/csv-import.ts": { lines: 90, functions: 90 },
        "lib/notifications/*.ts": { lines: 90, functions: 90 },
        "lib/offline/*.ts": { lines: 90, functions: 90 },
      },
    },

    // Timeout configuration
    testTimeout: 10000,
    hookTimeout: 10000,

    // Reporter configuration
    reporters: ["verbose"],

    // Isolation between tests
    isolate: true,
    threads: true,
    maxThreads: 4,
    minThreads: 1,

    // Bail on first error (useful during development)
    bail: 0,
    // Run tests in order (useful for debugging)
    shuffle: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
    },
  },
});
