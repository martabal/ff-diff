import { defineConfig } from "vite";
import pkg from "./package.json";
import path from "node:path";

const minify = !!process.env.MINIFY;

const input = process.env.USAGE
  ? "src/scripts/usage.ts"
  : process.env.COMPLETION
    ? "src/scripts/shell-completion.ts"
    : "src/index.ts";

export default defineConfig({
  build: {
    rollupOptions: {
      input,
      output: {
        dir: "dist",
      },
    },
    minify,
    ssr: true,
  },
  resolve: {
    alias: {
      "@cli": path.resolve(__dirname, "./src/cli"),
      "@commands": path.resolve(__dirname, "./src/commands"),
      "@lib": path.resolve(__dirname, "./src/lib"),
      "@scripts": path.resolve(__dirname, "./src/scripts"),
    },
  },
  define: {
    APP_NAME: JSON.stringify(pkg.name),
    APP_VERSION: JSON.stringify(pkg.version),
    APP_DESCRIPTION: JSON.stringify(pkg.description),
  },
});
