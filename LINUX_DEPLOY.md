# Guía de Despliegue en Linux (Debian 24.04 / Ubuntu)

Esta guía detalla cómo configurar y ejecutar el Asistente Minverso en un servidor Linux.

## Requisitos Previos

- Un servidor con Debian 24.04 o Ubuntu 22.04/24.04.
- Acceso a internet.
- Permisos de `sudo`.

## Pasos de Instalación

1.  **Transferir Archivos**
    Sube los archivos del proyecto a tu servidor (puedes usar Git, SCP, etc.).
    ```bash
    # Ejemplo con git
    git clone <tu-repositorio> asistente-minverso
    cd asistente-minverso
    ```

2.  **Dar permisos de ejecución al script de configuración**
    Una vez dentro de la carpeta del proyecto:
    ```bash
    chmod +x setup-linux.sh
    ```

3.  **Ejecutar el script de configuración**
    Este script instalará Node.js y todas las librerías de sistema necesarias para que WhatsApp (Puppeteer) funcione correctamente.
    ```bash
    ./setup-linux.sh
    ```
    *Nota: Te pedirá tu contraseña de usuario para instalar paquetes con `sudo`.*

4.  **Configurar Variables de Entorno**
    Crea o edita el archivo `.env` con tus claves API.
    ```bash
    cp .env.example .env
    nano .env
    ```
    Asegúrate de configurar `GOOGLE_API_KEY` y otras variables necesarias.

5.  **Iniciar el Servidor**
    ```bash
    npm run server
    ```

## Solución de Problemas (WhatsApp)

Si al iniciar ves errores relacionados con Chrome/Puppeteer:

- **Error de "Shared libraries"**: Asegúrate de haber ejecutado `./setup-linux.sh` completamente.
- **Modo Sandbox**: El código ya está configurado para usar `--no-sandbox` que es necesario en algunos entornos server (especialmente si ejecutas como root, aunque no se recomienda).

## Ejecutar en Producción (PM2)

Para mantener el servidor corriendo en segundo plano:

1.  Instalar PM2:
    ```bash
    sudo npm install -g pm2
    ```
2.  Iniciar proceso:
    ```bash
    pm2 start server/index.js --name "minverso-avatar"
    ```
3.  Ver logs:
    ```bash
    pm2 logs minverso-avatar
    ```
