import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
    environment: "node",
    env: { CRM_TOKEN: "secreto123" },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
