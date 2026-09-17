import { defineConfig } from "vitest/config";

// jsdom environment, because every test renders react into a dom
export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    include: ["tests/**/*.test.{ts,tsx}"],
  },
});
