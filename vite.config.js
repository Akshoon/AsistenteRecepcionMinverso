import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    https: {
      pfx: fs.readFileSync('C:\\certificados\\minverso.pfx'),
      passphrase: 'minverso123'
    },
    proxy: {
      '/api': {
        target: 'https://localhost:3000',
        changeOrigin: true,
        secure: false // Permite certificados autofirmados
      }
    }
  }
})
