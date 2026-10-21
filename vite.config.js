import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // Escuchar en todas las interfaces de red
    port: 5173, // Puerto por defecto
    strictPort: true, // No intentes otro puerto si este está ocupado
    cors: true, // Habilitar CORS
  }
})
