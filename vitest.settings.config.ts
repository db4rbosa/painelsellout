import { defineConfig } from "vitest/config";

// Server-function unit tests must run without the production RPC transform.
export default defineConfig({
  resolve: { alias: { "@": new URL("./src", import.meta.url).pathname } },
  test: { environment: "node" },
});