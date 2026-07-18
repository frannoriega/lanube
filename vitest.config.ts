import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // Inline (empty) PostCSS config so tests don't load the app's Tailwind PostCSS
  // config. Some modules (e.g. the brand logo) import a stylesheet; tests only
  // need the JS, not the CSS pipeline.
  css: {
    postcss: { plugins: [] },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // Neutralize the "server-only" guard so server modules (prisma, registry)
      // can be imported by unit tests running in the node environment.
      "server-only": path.resolve(__dirname, "./test/server-only.stub.ts"),
    },
  },
});
