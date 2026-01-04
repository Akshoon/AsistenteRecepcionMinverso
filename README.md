# Asistente con Avatar 3D

Asistente de voz con avatar 3D animado usando React, Three.js y Gemini API.

## 📁 Estructura

```
avatar-app/
├── server/                # Backend
│   ├── index.js           # Servidor WebSocket + Gemini
│   └── data/
│       └── conocimiento.txt  # Base de conocimiento
│
├── src/                   # Frontend React
│   ├── components/
│   │   └── Avatar3D.jsx   # Modelo 3D + lip-sync
│   ├── hooks/
│   │   └── useAudioAnalyzer.js
│   ├── App.jsx            # Componente principal
│   └── App.css
│
├── public/
│   └── avatar.glb         # ⚠️ TU AVATAR AQUÍ
│
├── .env                   # API Key
└── package.json
```

## 🚀 Instalación

### 1. Descargar Avatar
- [Ready Player Me](https://demo.readyplayer.me/avatar) → crear → descargar `.glb`
- Guardar como `public/avatar.glb`

### 2. Configurar API Key
```bash
cp .env.example .env
# Editar .env con tu GOOGLE_API_KEY
```

### 3. Instalar
```bash
npm install
```

## ▶️ Ejecutar

**Terminal 1 - Backend:**
```bash
npm run server
```

**Terminal 2 - Frontend:**
```bash
npm run dev
```

**Abrir:** http://localhost:5173

## 🎯 Uso
1. **Conectar** → Inicia WebSocket
2. **Hablar** → Captura audio
3. Avatar **mueve la boca** al responder 🎭
