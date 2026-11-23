import { defaultConfig } from "vitest";
export default defaultConfig({
  test: {
    environment: "node",
    testTimeout: 6000,
    hookTimeout: 6000,
    fileParallelism: false, //Avoid different test files interfering with a shared test database.
  },
});
