#!/bin/bash

# setup-linux.sh
# Script de configuración para Debian 24.04 / Ubuntu

echo "=== Configurando entorno para Minverso Avatar en Linux ==="

# 1. Actualizar repositorios
echo "[1/4] Actualizando repositorios..."
sudo apt-get update

# 2. Instalar Node.js (si no está instalado)
if ! command -v node &> /dev/null; then
    echo "[2/4] Instalando Node.js..."
    # Usar NodeSource para una versión reciente (v20 LTS recomendada)
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
else
    echo "[2/4] Node.js ya instalado: $(node -v)"
fi

# 3. Instalar dependencias de sistema para Puppeteer/Chrome
echo "[3/4] Instalando bibliotecas necesarias para Puppeteer..."
sudo apt-get install -y \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libc6 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libexpat1 \
    libfontconfig1 \
    libgbm1 \
    libgcc1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libstdc++6 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxtst6 \
    lsb-release \
    wget \
    xdg-utils

# 4. Instalar dependencias del proyecto
echo "[4/4] Instalando dependencias del proyecto (npm install)..."
npm install

echo "=== Configuración completada ==="
echo "Ahora puedes ejecutar el servidor con: npm run server"
