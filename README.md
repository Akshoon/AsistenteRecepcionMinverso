# Manual Tecnico y Operativo: Asistente Minverso

Este documento constituye la referencia tecnica completa para el sistema Asistente Minverso. Detalla la arquitectura, los flujos de datos, la logica interna de los componentes y los procedimientos de operacion.

## 1. Introduccion y Alcance

El Asistente Minverso es una solucion de inteligencia artificial conversacional corporealizada (embodied AI). A diferencia de los chatbots tradicionales de texto, este sistema integra:
1.  **Percepcion Auditiva**: Capacidad de escuchar y procesar voz humana en tiempo real.
2.  **Presencia Visual**: Un avatar 3D antropomorfico que sincroniza sus labios con el habla.
3.  **Capacidad de Accion**: Habilidad para afectar el mundo fisico a traves de integraicones IoT (Internet de las Cosas).

El objetivo del sistema es actuar como un recepcionista o guia virtual autonomo, capaz de saludar a visitantes, responder consultas sobre la organizacion y ejecutar comandos de domotica.

## 2. Arquitectura del Sistema

El sistema sigue una arquitectura de microservicios monoliticos, donde un servidor central Node.js coordina multiples servicios internos y externos.

### 2.1 Diagrama de Componentes Logicos

```
[CLIENTE: Navegador Web]
    |-- Microfono (Audio Input)
    |-- Altavoces (Audio Output)
    |-- Motor 3D (Three.js/WebGL)
    |-- Gestor de Estado (React)
    |
    v (WebSocket Seguro WSS)
    |
[SERVIDOR: Node.js]
    |-- Servidor HTTP/HTTPS (Express)
    |-- Gestor de WebSockets (ws)
    |-- Registro de Servicios (ServiceRegistry)
    |
    |-- [Modulo IA] <===> API Google Gemini (Multimodal Live)
    |-- [Modulo WhatsApp] <===> Puppeteer / WhatsApp Web
    |-- [Modulo IoT] <===> Dispositivos Fisicos (HTTP/Webhooks)
    |-- [Gestor de Datos] <===> Sistema de Archivos (JSON/TXT)
```

## 3. Funcionamiento Interno: Flujos de Datos

### 3.1 Pipeline de Audio y Voz (El "Cerebro")
El sistema utiliza el modelo **Gemini 2.5 Flash Native Audio**, lo que elimina la necesidad de sistemas STT (Speech-to-Text) y TTS (Text-to-Speech) intermedios, reduciendo la latencia drasticamente.

1.  **Captura**: El navegador captura el audio del usuario mediante la Web Audio API (`AudioContext`).
2.  **Streaming**: El audio se convierte a Base64 y se envia en tramas continuas via WebSocket al servidor.
3.  **Reenvio**: El servidor actua como proxy, retransmitiendo el audio directamente a la API de Google Gemini en tiempo real.
4.  **Procesamiento**: Gemini procesa la entrada multimodal (audio + contexto de texto).
5.  **Generacion**: Gemini devuelve tramas de audio (respuesta de voz) y texto (transcripcion) simultaneamente.
6.  **Reproduccion**: El frontend recibe el audio, lo decodifica y lo reproduce en cola secuencial.

### 3.2 Pipeline de Animacion del Avatar
Para que el avatar parezca "vivo", el movimiento de la boca no es una animacion pregrabada, sino generada matematicamente a partir del sonido.

1.  **Analisis Espectral**: Mientras se reproduce el audio de respuesta, el `useAudioAnalyzer` (Hook de React) muestrea la frecuencia del sonido cada 16ms (60 FPS).
2.  **Calculo de Visemas**: Se analiza la energia en bandas de frecuencia claves (formantes) para estimar que fonema/visema se esta pronunciando (A, E, O, U, Bilabial, Dental).
3.  **Morph Targets**: Se aplican pesos (0.0 a 1.0) a los "Morph Targets" (deformadores) de la malla 3D del avatar.
    *   Ejemplo: Si la energia en 1kHz es alta, se aumenta el peso de `aa` (boca abierta).
4.  **Suavizado**: Se aplica interpolacion lineal (Lerp) para evitar movimientos bruscos o roboticos.

### 3.3 Pipeline de Ejecucion de Herramientas (Function Calling)
Cuando el usuario pide algo que requiere accion externa (ej: "Enciende la luz"), el flujo cambia:

1.  **Deteccion de Intencion**: Gemini analiza el prompt del usuario. Si coincide con la definicion de una herramienta (ej: `visit_url`), pausa la generacion de respuesta verbal.
2.  **Solicitud de Ejecucion**: Gemini envia un evento `tool_use` al servidor con los argumentos necesarios (ej: `{ "url": "http://192.168.1.50/on" }`).
3.  **Ejecucion Local**: El `ToolHandler` del servidor recibe la solicitud, verifica permisos y ejecuta la accion (llamada HTTP, funcion interna, etc.).
4.  **Retorno de Resultado**: El servidor envia el resultado de la herramienta (ej: "Exito, luz encendida") de vuelta a Gemini.
5.  **Respuesta Final**: Gemini genera una respuesta verbal para el usuario confirmando la accion ("Listo, he encendido la luz").

## 4. Detalle de Modulos

### 4.1 Modulo Backend y Servicios (`/server`)

*   **`index.js`**: Punto de entrada. Inicializa el servidor HTTPS, el WebSocket y conecta los servicios.
*   **`ServiceRegistry.js`**: Patron de diseño Singleton que gestiona el ciclo de vida de todos los servicios. Permite obtener instancias de cualquier servicio (IoT, Data, WhatsApp) desde cualquier parte del codigo.
*   **`tools.js`**: Define las "habilidades" que la IA conoce. Cada herramienta tiene un esquema JSON (nombre, descripcion, parametros) que se envia a Gemini al iniciar la sesion.
*   **`WhatsAppService.js`**:
    *   Utiliza una instancia de navegador Chromium (headless o con interfaz) controlada por Puppeteer.
    *   Inyecta scripts en la pagina de WhatsApp Web para detectar elementos del DOM (botones de enviar, cuadros de texto).
    *   Mantiene la sesion guardando las cookies y LocalStorage en `/server/data/whatsapp-session`.

### 4.2 Modulo Frontend (`/src`)

*   **`App.jsx`**: Componente raiz. Maneja la conexion WebSocket principal y la interfaz de usuario (chat superpuesto, indicadores de estado).
*   **`Avatar3D.jsx`**: Componente de Three.js. Carga el modelo GLB, configura la iluminacion y la camara. Contiene el bucle de renderizado (`useFrame`) que actualiza los gestos faciales frame a frame.
*   **`useAudioRecorder` y `useAudioPlayer`**: Hooks personalizados para manejar la complejidad del buffer de audio, evitar clics/pops en el sonido y gestionar las colas de reproduccion.

## 5. Guia de Configuracion Avanzada

El sistema se gobierna mediante archivos en `server/data/`, permitiendo cambios en caliente (hot-swap) en algunos casos.

### 5.1 `instrucciones.json` (El "Cerebro Operativo")
Este archivo es crucial. Define las reglas de negocio especificas.
*   **`description`**: Prompt del sistema. Define la personalidad (ej: "Eres un asistente formal...").
*   **`commands`**: Mapeo estricto de Disparador -> Accion.
    *   *Uso*: Si Gemini falla en "entender" una orden compleja, se puede forzar un comportamiento aqui.
    *   *Ejemplo*: Si el usuario dice "Codigo Rojo", ejecutar la herramienta de alerta inmediata.

### 5.2 `integrations.json` (Panel de Control de Modulos)
Permite encender/apagar partes del sistema para depuracion o despliegue limitado.
```json
{
  "WhatsApp": { "enabled": true },
  "IoT": { "enabled": false },     // Desactiva control de luces
  "Avatar": { "enabled": true }
}
```

## 6. Procedimientos de Mantenimiento

### 6.1 Actualizacion del Avatar
1.  Obtener nuevo modelo `.glb` (optimizado para web).
2.  Renombrar a `avatar.glb`.
3.  Reemplazar el archivo en `public/`.
4.  Refrescar el navegador (no requiere reinicio del servidor).
*Nota: El avatar debe tener el estandar de nombres de Morph Targets de ARKit para que el Lip-Sync funcione.*

### 6.2 Reinicio de Sesion de WhatsApp
Si la sesion caduca o falla:
1.  Detener el servidor.
2.  Eliminar la carpeta `server/data/whatsapp-session`.
3.  Iniciar el servidor.
4.  Escanear el nuevo QR que aparecera en la terminal o logs.

## 7. Solucion de Problemas (Troubleshooting)

### Latencia Alta en Respuestas
*   **Causa**: Conexion a internet inestable o saturacion de la API de Gemini.
*   **Solucion**: Verificar ancho de banda. El audio en streaming consume aprox 100-200kbps constantes.

### "No te escucho"
*   **Causa**: El navegador bloqueo el microfono.
*   **Diagnostico**: Mirar el icono de candado/microfono en la barra de direcciones del navegador.
*   **Solucion**: Asegurar que se accede por `https://` y no `http://` (excepto localhost). Verificar permisos del sitio.

### El Avatar no mueve la boca
*   **Causa 1**: El volumen del audio de respuesta es muy bajo (el analizador no detecta energia).
*   **Causa 2**: El modelo 3D no tiene los ShapeKeys/MorphTargets con los nombres correctos (`aa`, `E`, etc).
*   **Solucion**: Probar con otro modelo estandar de Ready Player Me para descartar problemas de codigo.

### Errores de Certificado SSL
*   **Mensaje**: `NET::ERR_CERT_AUTHORITY_INVALID`
*   **Explicacion**: Normal en desarrollo con certificados autofirmados.
*   **Accion**: Hacer clic en "Avanzado" -> "Continuar a localhost (no seguro)". Esto no afecta el cifrado, solo la validacion de identidad.

