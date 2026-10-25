import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    // pdf.js worker is a single ~1.2MB file that can't be split; raise the
    // advisory limit so the production build output stays clean.
    chunkSizeWarningLimit: 2000,
  },
})
