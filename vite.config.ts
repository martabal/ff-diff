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
    APP_NAME: JSON.stringify(process.env.npm_package_name),
    APP_VERSION: JSON.stringify(process.env.npm_package_version),
    APP_DESCRIPTION: JSON.stringify(pkg.description),
  },
});
