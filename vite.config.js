import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  root: "./",
  build: {
    outDir: "dist",
  },
  publicDir: "resources",

  plugins: [react()],

  server: {
    host: true, // Allow LAN access
    port: 5173,
    proxy: {
      '/timber-api': 'http://127.0.0.1:8000/',  // Point this to your Laravel backend
    }
  }
});
