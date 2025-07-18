import { defineConfig } from "vite";
import pkg from "./package.json";

const minify = !!process.env.MINIFY;

export default defineConfig({
  build: {
    rollupOptions: {
      input: "src/index.ts",
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
