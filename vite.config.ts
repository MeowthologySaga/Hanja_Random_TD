import { sites } from "@openai/sites-vite-plugin";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [sites()],
  base: "./",
  server: {
    host: "127.0.0.1",
    port: 4437,
    strictPort: true
  },
  preview: {
    host: "127.0.0.1",
    port: 4438,
    strictPort: true
  },
  build: {
    target: "es2022",
    outDir: "dist",
    sourcemap: true
  }
});
