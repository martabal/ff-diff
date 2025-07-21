import { defineConfig } from "vite";
import pkg from "./package.json";

const minify = !!process.env.MINIFY;

const input = process.env.USAGE ? "src/usage.ts" : "src/index.ts";

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
  define: {
    APP_NAME: JSON.stringify(pkg.name),
    APP_VERSION: JSON.stringify(pkg.version),
    APP_DESCRIPTION: JSON.stringify(pkg.description),
  },
});
