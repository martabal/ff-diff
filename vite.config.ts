import { defineConfig } from "vite";

const minify = process.env.MINIFY ? "esbuild" : false;

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
});
