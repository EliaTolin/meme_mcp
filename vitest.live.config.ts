import { defineConfig } from "vitest/config";

// Runs against the real Imgflip API: needs credentials in the environment.
export default defineConfig({
  test: { include: ["test/**/*.live.test.ts"], testTimeout: 30_000 },
});
