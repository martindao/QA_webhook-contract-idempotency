// vitest.config.js
// Configuration for running tests with proper sequencing

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Run tests sequentially to avoid port conflicts in integration tests
    // Each integration test spawns servers on ports 3002 and 3003
    sequence: {
      concurrent: false
    },
    // Increase timeout for integration tests that spawn servers
    testTimeout: 30000,
    hookTimeout: 30000
  }
});
