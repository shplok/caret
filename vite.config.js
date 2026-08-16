import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/caret/', // served from https://shplok.github.io/caret/
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
  },
})
