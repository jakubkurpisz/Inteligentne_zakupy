import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,  // Nie pozwól Vite na automatyczną zmianę portu
    host: true  // Udostępnij aplikację w sieci lokalnej
  }
})
