import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

module.exports = {
  root: './',
  build: {
      outDir: 'dist',
  },
  publicDir: 'resources',

  plugins: [react()],

  server:{
    host: true,
  },

} 
