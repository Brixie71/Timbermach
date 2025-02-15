import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  root: "./",
  build: {
    assetsInlineLimit: 4096, 
    outDir: 'dist', 
    emptyOutDir: true,
  },
  publicDir: "resources",

  plugins: [react()],

  server: {
    host: true,
  },
});
