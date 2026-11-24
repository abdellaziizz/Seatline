import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    environment: "node",
    // sets NODE_ENV=test + safe env values before any app code is imported
    setupFiles: ["./backend/tests/vitest.setup.js"],
    include: ["backend/tests/**/*.test.js"],
    testTimeout: 60000,
    hookTimeout: 60000,
    fileParallelism: false, //Avoid different test files interfering with a shared test database.
  },
});
