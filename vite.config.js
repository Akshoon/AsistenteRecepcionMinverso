import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

// Detectar si estamos en Windows (desarrollo) o Linux (producción)
const isWindows = process.platform === 'win32'
const certPath = 'C:\\certificados\\minverso.pfx'

// Solo cargar certificado HTTPS en Windows si existe
const getHttpsConfig = () => {
  if (isWindows && fs.existsSync(certPath)) {
    return {
      pfx: fs.readFileSync(certPath),
      passphrase: 'minverso123'
    }
  }
  return false // Sin HTTPS en Linux (Nginx lo maneja)
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    https: getHttpsConfig(),
    proxy: {
      '/api': {
        target: isWindows ? 'https://localhost:3000' : 'http://localhost:3000',
        changeOrigin: true,
        secure: false
      }
    }
  }
})
