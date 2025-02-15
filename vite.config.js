import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  root: "./",
  build: {
<<<<<<< HEAD
    assetsInlineLimit: 4096, 
    outDir: 'dist', 
    emptyOutDir: true,
=======
    outDir: "dist",
>>>>>>> 58f678a9b50c7930632ab247bbfeabf78fd910ef
  },
  publicDir: "resources",

  plugins: [react()],

  server: {
    host: true,
  },
});
