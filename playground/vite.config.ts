import { defineConfig } from "vite";

const root = decodeURIComponent(new URL(".", import.meta.url).pathname);

export default defineConfig({
  root,
  server: { host: "127.0.0.1" },
  build: {
    outDir: "../playground-dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: `${root}index.html`,
        preview: `${root}preview.html`,
      },
    },
  },
});
