import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite' // Tambahkan baris ini

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(), // Tambahkan baris ini
  ],
})