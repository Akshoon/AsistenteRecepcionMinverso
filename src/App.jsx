import { useState, useRef, useCallback, useEffect, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment } from '@react-three/drei';
import Avatar3D from './components/Avatar3D';
import useAudioAnalyzer from './hooks/useAudioAnalyzer';
import './App.css';

function App() {
  const [isConnected, setIsConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [status, setStatus] = useState('Desconectado');

  // WhatsApp state
  const [whatsappStatus, setWhatsappStatus] = useState(null);
  const [showQRModal, setShowQRModal] = useState(false);
  const [qrCode, setQrCode] = useState(null);
  const [showNotificationDialog, setShowNotificationDialog] = useState(false);
  const [visitorName, setVisitorName] = useState('');
  const [visitorPhone, setVisitorPhone] = useState('');

  const wsRef = useRef(null);
  const audioContextRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const processorRef = useRef(null);
  const audioQueueRef = useRef([]);
  const isPlayingRef = useRef(false);
  const isRecordingRef = useRef(false); // Ref para el callback

  const { audioLevel, setAudioLevel, lipSyncData, setLipSyncData, analyzeBuffer, analyzeFrequencies } = useAudioAnalyzer();
  const scheduledEndTimeRef = useRef(0);
  const audioDataRef = useRef([]); // Guardar datos de audio para análisis continuo
  const testIntervalRef = useRef(null);

  // === FUNCIONES DE PRUEBA PARA CONSOLA ===
  useEffect(() => {
    // Función para simular lip sync con texto
    window.testLipSync = (text = "Hola, esto es una prueba de lip sync") => {
      console.log('🎤 Iniciando prueba de lip sync:', text);
      if (testIntervalRef.current) clearInterval(testIntervalRef.current);

      const chars = text.toLowerCase().split('');
      let index = 0;

      testIntervalRef.current = setInterval(() => {
        if (index >= chars.length) {
          setLipSyncData({ mouthOpen: 0, mouthWide: 0, jawOpen: 0, lipsPursed: 0, tongueOut: 0 });
          setAudioLevel(0);
          clearInterval(testIntervalRef.current);
          console.log('✅ Prueba terminada');
          return;
        }

        const char = chars[index];
        // Lógica simplificada para evitar errores
        let mouthOpen = 0;
        if ('aáä'.includes(char)) mouthOpen = 0.8;
        else if ('eéë'.includes(char)) mouthOpen = 0.4;
        else if ('oóö'.includes(char)) mouthOpen = 0.6;
        else if ('uúü'.includes(char)) mouthOpen = 0.3;
        else if ('iíï'.includes(char)) mouthOpen = 0.2;
        else mouthOpen = 0.1;

        setLipSyncData({ mouthOpen, mouthWide: 0, jawOpen: mouthOpen * 0.5, lipsPursed: 0, tongueOut: 0 });
        setAudioLevel(Math.random() * 0.5 + 0.2);

        index++;
      }, 100);
    };

    // Función GLOBAL para enviar texto a Gemini desde consola
    window.chat = (text) => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        console.log('📤 Enviando texto a Gemini:', text);
        wsRef.current.send(JSON.stringify({
          type: 'text',
          text: text
        }));
      } else {
        console.error('❌ WebSocket no desconectado. Espera a que se conecte.');
      }
    };

    window.testMouth = (value = 0.5) => {
      setLipSyncData({
        mouthOpen: value,
        mouthWide: value * 0.3,
        jawOpen: value * 0.8,
        lipsPursed: 0,
        tongueOut: 0
      });
      setAudioLevel(value);
      console.log('🎭 Boca abierta a:', value);
      return 'Boca abierta a ' + value;
    };

    // Función para detener prueba
    window.stopTest = () => {
      if (testIntervalRef.current) {
        clearInterval(testIntervalRef.current);
      }
      setLipSyncData({
        mouthOpen: 0,
        mouthWide: 0,
        jawOpen: 0,
        lipsPursed: 0,
        tongueOut: 0
      });
      setAudioLevel(0);
      console.log('⏹️ Prueba detenida');
      return 'Prueba detenida';
    };

    console.log('🧪 Funciones de prueba disponibles:');
    console.log('  - testLipSync("texto para animar")');
    console.log('  - testMouth(0.5) // valor de 0 a 1');
    console.log('  - stopTest()');

    return () => {
      if (testIntervalRef.current) {
        clearInterval(testIntervalRef.current);
      }
      delete window.testLipSync;
      delete window.testMouth;
      delete window.stopTest;
      delete window.testMorphIndex;
      delete window.scanMorphs;
    };
  }, [setAudioLevel, setLipSyncData]);

  // Función global para probar índices de morph targets
  useEffect(() => {
    // Función para probar un índice específico de morph target
    window.testMorphIndex = (index, value = 1) => {
      const canvas = document.querySelector('canvas');
      if (!canvas || !canvas.__r3f) {
        console.log('❌ No se encontró el canvas de Three.js');
        return;
      }

      const scene = canvas.__r3f.fiber.scene;
      let found = false;

      scene.traverse((child) => {
        if (child.isMesh && child.morphTargetDictionary && child.morphTargetInfluences) {
          const key = String(index);
          if (child.morphTargetDictionary[key] !== undefined) {
            const morphIndex = child.morphTargetDictionary[key];
            child.morphTargetInfluences[morphIndex] = value;
            found = true;
            console.log(`✅ Aplicado morph índice ${index} = ${value} en ${child.name}`);
          }
        }
      });

      if (!found) {
        console.log(`❌ No se encontró morph índice ${index}`);
      }
      return found ? `Morph ${index} = ${value}` : 'No encontrado';
    };

    // Función para escanear rangos de morphs y encontrar los de boca
    window.scanMorphs = (start = 0, end = 50, value = 0.8, delay = 500) => {
      console.log(`🔍 Escaneando morphs del ${start} al ${end}...`);
      console.log('⏸️ Escribe stopScan() para detener');

      let current = start;
      window._scanInterval = setInterval(() => {
        if (current > end) {
          clearInterval(window._scanInterval);
          console.log('✅ Escaneo terminado');
          // Reset todos
          for (let i = start; i <= end; i++) {
            window.testMorphIndex(i, 0);
          }
          return;
        }

        // Reset anterior
        if (current > start) {
          window.testMorphIndex(current - 1, 0);
        }

        // Activar actual
        console.log(`📍 Probando índice ${current}...`);
        window.testMorphIndex(current, value);
        current++;
      }, delay);

      return `Escaneando... (stopScan() para detener)`;
    };

    window.stopScan = () => {
      if (window._scanInterval) {
        clearInterval(window._scanInterval);
        console.log('⏹️ Escaneo detenido');
        // Reset todos los morphs
        for (let i = 0; i < 200; i++) {
          window.testMorphIndex(i, 0);
        }
      }
      return 'Escaneo detenido';
    };

    console.log('🔧 Funciones de debug de morphs:');
    console.log('  - testMorphIndex(17, 0.8) // probar índice específico');
    console.log('  - scanMorphs(50, 100) // escanear rango buscando boca');
    console.log('  - stopScan() // detener escaneo');

    return () => {
      delete window.testMorphIndex;
      delete window.scanMorphs;
      delete window.stopScan;
      if (window._scanInterval) clearInterval(window._scanInterval);
    };
  }, []);

  // Referencia para el nodo analizador compartido
  const outputAnalyzerRef = useRef(null);
  const outputDataArrayRef = useRef(null);

  // Referencia a la fuente de audio actual para poder detenerla
  const currentSourceRef = useRef(null);

  // Detener reproducción actual (Interrupción)
  const stopPlayback = useCallback(() => {
    if (currentSourceRef.current) {
      try {
        currentSourceRef.current.stop();
      } catch (e) {
        // Ignorar errores si ya estaba detenido
      }
      currentSourceRef.current = null;
    }
    // Limpiar cola de audio
    audioQueueRef.current = [];

    // Resetear tiempos
    if (audioContextRef.current) {
      scheduledEndTimeRef.current = audioContextRef.current.currentTime;
    }

    // Resetear estado visual
    setAudioLevel(0);
    setLipSyncData(null);
    isPlayingRef.current = false;

    console.log('🛑 Reproducción interrumpida y cola limpiada');
  }, [setAudioLevel, setLipSyncData]);

  // Reproducir audio con scheduling preciso
  const playAudioChunk = useCallback((base64Data) => {
    if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });
      scheduledEndTimeRef.current = audioContextRef.current.currentTime;

      // Inicializar analizador para el output (Gemini)
      outputAnalyzerRef.current = audioContextRef.current.createAnalyser();
      outputAnalyzerRef.current.fftSize = 1024; // Alta resolución para vocales
      outputAnalyzerRef.current.smoothingTimeConstant = 0.5;
      outputDataArrayRef.current = new Uint8Array(outputAnalyzerRef.current.frequencyBinCount);
    }

    const ctx = audioContextRef.current;

    try {
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Guardar para análisis continuo (backup de volumen)
      const samples = new Int16Array(bytes.buffer);
      audioDataRef.current.push({ samples, startTime: scheduledEndTimeRef.current });

      // PCM a Float32
      const floatSamples = new Float32Array(samples.length);
      for (let i = 0; i < samples.length; i++) {
        floatSamples[i] = samples[i] / 32768.0;
      }

      const audioBuffer = ctx.createBuffer(1, floatSamples.length, 24000);
      audioBuffer.copyToChannel(floatSamples, 0);

      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;

      // CONEXIÓN CLAVE: Source -> Analyzer -> Speakers
      if (outputAnalyzerRef.current) {
        source.connect(outputAnalyzerRef.current);
        outputAnalyzerRef.current.connect(ctx.destination);
      } else {
        source.connect(ctx.destination);
      }

      const startTime = Math.max(ctx.currentTime, scheduledEndTimeRef.current);
      source.start(startTime);
      scheduledEndTimeRef.current = startTime + audioBuffer.duration;

      // Guardar referencia para interrupciones
      currentSourceRef.current = source;
      isPlayingRef.current = true;

      source.onended = () => {
        if (currentSourceRef.current === source) {
          currentSourceRef.current = null;
        }
        if (ctx.currentTime >= scheduledEndTimeRef.current - 0.05) {
          isPlayingRef.current = false;
        }
      };

    } catch (error) {
      console.error('Error audio:', error);
    }
  }, []);

  // Analizar audio continuamente mientras reproduce (Volumen + LipSync)
  useEffect(() => {
    const interval = setInterval(() => {
      const ctx = audioContextRef.current;
      const analyzer = outputAnalyzerRef.current;

      // 1. Análisis de Frecuencia (Lip Sync real)
      if (ctx && analyzer && outputDataArrayRef.current) {
        analyzer.getByteFrequencyData(outputDataArrayRef.current);

        // Usar la función experta del hook para extraer fonemas
        const lipSync = analyzeFrequencies(outputDataArrayRef.current, ctx.sampleRate);
        if (lipSync) {
          setLipSyncData(lipSync);
          // Usar el nivel calculado por el analizador de frecuencias como fuente primaria
          if (lipSync.level > 0.01) {
            setAudioLevel(lipSync.level);
            return; // Prioridad al analizador FFT
          }
        }
      }

      // 2. Fallback: Análisis de Time-Domain (RMS) si FFT no da datos
      if (ctx && audioDataRef.current.length > 0) {
        const currentTime = ctx.currentTime;

        // Limpieza de chunks viejos
        if (audioDataRef.current.length > 20) {
          audioDataRef.current = audioDataRef.current.filter(d => d.startTime + (d.samples.length / 24000) > currentTime - 1);
        }

        for (const data of audioDataRef.current) {
          const duration = data.samples.length / 24000;
          if (currentTime >= data.startTime && currentTime < data.startTime + duration) {
            const offset = Math.floor((currentTime - data.startTime) * 24000);
            const windowSize = Math.min(2400, data.samples.length - offset); // 100ms
            if (windowSize > 0) {
              let sum = 0;
              for (let i = 0; i < windowSize; i++) {
                sum += data.samples[offset + i] * data.samples[offset + i];
              }
              const rms = Math.sqrt(sum / windowSize);
              const level = Math.min(1, rms / 10000); // 10000 para normalizar PCM 16bit
              setAudioLevel(level);
            } else {
              setAudioLevel(0);
            }
            return;
          }
        }
      }

      // Si no hay audio sonando activamente
      setAudioLevel(0);
      setLipSyncData(null);

    }, 30); // 30ms (~33fps) para respuesta rápida

    return () => clearInterval(interval);
  }, [setAudioLevel, setLipSyncData, analyzeFrequencies]);

  // Reproducir chunk MP3 (ElevenLabs)
  const playMp3Chunk = useCallback(async (base64Data) => {
    if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });
      scheduledEndTimeRef.current = audioContextRef.current.currentTime;

      // Inicializar analizador
      outputAnalyzerRef.current = audioContextRef.current.createAnalyser();
      outputAnalyzerRef.current.fftSize = 1024;
      outputAnalyzerRef.current.smoothingTimeConstant = 0.5;
      outputDataArrayRef.current = new Uint8Array(outputAnalyzerRef.current.frequencyBinCount);
    }

    const ctx = audioContextRef.current;

    try {
      // Convertir base64 a ArrayBuffer
      const binaryString = atob(base64Data);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Decodificar MP3
      const audioBuffer = await ctx.decodeAudioData(bytes.buffer);

      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;

      // Conectar analizador para lip sync
      if (outputAnalyzerRef.current) {
        source.connect(outputAnalyzerRef.current);
        outputAnalyzerRef.current.connect(ctx.destination);
      } else {
        source.connect(ctx.destination);
      }

      const startTime = Math.max(ctx.currentTime, scheduledEndTimeRef.current);
      source.start(startTime);
      scheduledEndTimeRef.current = startTime + audioBuffer.duration;

      // Guardar referencia para interrupciones
      currentSourceRef.current = source;
      isPlayingRef.current = true;

      source.onended = () => {
        if (currentSourceRef.current === source) {
          currentSourceRef.current = null;
        }
        if (ctx.currentTime >= scheduledEndTimeRef.current - 0.05) {
          isPlayingRef.current = false;
        }
      };

    } catch (error) {
      console.error('Error decodificando MP3:', error);
    }
  }, []);

  const playAudioQueue = useCallback(async () => {
    while (audioQueueRef.current.length > 0) {
      const item = audioQueueRef.current.shift();

      // Chequear si es objeto complejo (ElevenLabs) o string simple (Gemini PCM)
      if (typeof item === 'object' && item.isMp3) {
        await playMp3Chunk(item.data);
      } else {
        // Asumir PCM base64 string
        const data = typeof item === 'string' ? item : item.data;
        playAudioChunk(data);
      }
    }
  }, [playAudioChunk, playMp3Chunk]);

  // Conectar WebSocket
  const connect = useCallback(async () => {
    try {
      setStatus('Conectando...');

      // Verificar que getUserMedia esté disponible (requiere HTTPS en dispositivos externos)
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        const isSecure = window.isSecureContext;
        const errorMsg = isSecure
          ? 'Tu navegador no soporta acceso al micrófono.'
          : 'El acceso al micrófono requiere HTTPS. En Chrome, puedes usar: chrome --unsafely-treat-insecure-origin-as-secure="' + window.location.origin + '"';
        setStatus('Error: ' + errorMsg);
        alert(errorMsg);
        return;
      }

      // Obtener acceso al micrófono
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true
        }
      });
      mediaStreamRef.current = stream;

      // Conectar WebSocket
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.hostname}:3000`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setStatus('Esperando conexión con Gemini...');
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);

        if (data.type === 'connected') {
          setIsConnected(true);
          const mode = data.voiceMode === 'elevenlabs' ? 'ElevenLabs' : 'Nativo';
          setStatus(`¡Conectado (${mode})! Haz clic en el micrófono para hablar`);

          // Actualizar estado de WhatsApp
          if (data.whatsappStatus) {
            setWhatsappStatus(data.whatsappStatus);
          }
        } else if (data.type === 'audio') {
          audioQueueRef.current.push(data.data);
          playAudioQueue();
        } else if (data.type === 'elevenlabs_audio') {
          // Audio MP3 de ElevenLabs
          audioQueueRef.current.push({ data: data.data, isMp3: true });
          playAudioQueue();
        } else if (data.type === 'text') {
          console.log('📝 Gemini:', data.text);
        } else if (data.type === 'whatsapp_notification') {
          // Abrir enlace de WhatsApp Web
          console.log(`📲 Abriendo WhatsApp para ${data.contactName}`);
          window.open(data.url, '_blank');
        } else if (data.type === 'whatsapp_sent') {
          alert('✓ Mensaje enviado correctamente');
          setShowNotificationDialog(false);
          setVisitorName('');
          setVisitorPhone('');
        } else if (data.type === 'whatsapp_error') {
          alert('Error enviando mensaje: ' + data.error);
        } else if (data.type === 'interrupted') {
          // Interrupción desde el servidor
          stopPlayback();
        }
      };

      ws.onerror = () => {
        setStatus('Error de conexión');
        setIsConnected(false);
      };

      ws.onclose = () => {
        setStatus('Desconectado');
        setIsConnected(false);
        setIsRecording(false);
      };

    } catch (error) {
      console.error('Error:', error);
      setStatus('Error: ' + error.message);
    }
  }, [playAudioQueue, setAudioLevel, stopPlayback]);

  // Procesar y enviar audio del micrófono
  const startRecording = useCallback(async () => {
    if (!mediaStreamRef.current || !wsRef.current) {
      console.log('No hay stream o websocket');
      return;
    }

    // Marcar como grabando ANTES de crear el processor
    isRecordingRef.current = true;
    setIsRecording(true);
    setStatus('Escuchando...');

    const audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
    const source = audioContext.createMediaStreamSource(mediaStreamRef.current);

    // Usar ScriptProcessor para capturar audio
    const processor = audioContext.createScriptProcessor(4096, 1, 1);
    processorRef.current = { audioContext, processor };

    processor.onaudioprocess = (event) => {
      // Usar ref en lugar de state para el check
      if (!isRecordingRef.current) return;

      const inputData = event.inputBuffer.getChannelData(0);

      // === ADAPTIVE THRESHOLD (ECHO GATE) ===
      // Calcular volumen del input (mic)
      let sum = 0;
      for (let i = 0; i < inputData.length; i++) {
        sum += inputData[i] * inputData[i];
      }
      const rms = Math.sqrt(sum / inputData.length);

      // Si el avatar está hablando, subimos el umbral requerida para enviar audio
      // Esto filtra el eco (que suele ser más bajo que la voz directa del usuario)
      // pero permite "Barge-in" si el usuario habla fuerte
      const isAvatarSpeaking = isPlayingRef.current && scheduledEndTimeRef.current > (audioContextRef.current?.currentTime || 0);
      const THRESHOLD = isAvatarSpeaking ? 0.05 : 0.005; // 10x umbral si está hablando

      // Si está hablando y el volumen es bajo, ignoramos (es eco probable)
      if (isAvatarSpeaking && rms < THRESHOLD) {
        return;
      }

      // Si pasó el umbral y el avatar hablaba, interrumpimos LOCALMENTE visualmente
      // (opcional, pero la interrupción real viene del servidor o al enviar)

      const pcmData = new Int16Array(inputData.length);
      for (let i = 0; i < inputData.length; i++) {
        pcmData[i] = Math.max(-32768, Math.min(32767, inputData[i] * 32768));
      }

      // Convertir a base64 y enviar
      const uint8Array = new Uint8Array(pcmData.buffer);
      let binary = '';
      for (let i = 0; i < uint8Array.length; i++) {
        binary += String.fromCharCode(uint8Array[i]);
      }
      const base64 = btoa(binary);

      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'audio',
          data: base64
        }));
      }
    };

    source.connect(processor);
    processor.connect(audioContext.destination);
  }, []);

  // Detener grabación
  const stopRecording = useCallback(() => {
    isRecordingRef.current = false; // Detener el callback primero
    if (processorRef.current) {
      processorRef.current.processor.disconnect();
      processorRef.current.audioContext.close();
      processorRef.current = null;
    }
    setIsRecording(false);
    setStatus('Micrófono apagado');
  }, []);

  // Toggle micrófono
  const toggleRecording = useCallback(() => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  // Desconectar
  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
    }
    stopRecording();
    setIsConnected(false);
  }, [stopRecording]);

  // Limpiar al desmontar
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  // Auto-connect on mount
  useEffect(() => {
    connect();
  }, [connect]);

  // Auto-start recording when connected
  useEffect(() => {
    if (isConnected && !isRecording) {
      console.log('🔌 Conectado, iniciando grabación automática...');
      startRecording();
    }
  }, [isConnected, isRecording, startRecording]);

  // WhatsApp Functions
  const initializeWhatsApp = async () => {
    try {
      const response = await fetch('http://localhost:3000/api/whatsapp/init', {
        method: 'POST'
      });
      const data = await response.json();

      if (data.status === 'waiting_qr') {
        // Obtener QR code
        const qrResponse = await fetch('http://localhost:3000/api/whatsapp/qr');
        const qrData = await qrResponse.json();
        if (qrData.qr) {
          setQrCode(qrData.qr);
          setShowQRModal(true);

          // Polling para verificar autenticación
          const checkAuth = setInterval(async () => {
            const statusResponse = await fetch('http://localhost:3000/api/whatsapp/status');
            const statusData = await statusResponse.json();
            setWhatsappStatus(statusData);

            if (statusData.authenticated) {
              setShowQRModal(false);
              clearInterval(checkAuth);
            }
          }, 2000);
        }
      } else if (data.status === 'authenticated') {
        const statusResponse = await fetch('http://localhost:3000/api/whatsapp/status');
        const statusData = await statusResponse.json();
        setWhatsappStatus(statusData);
      }
    } catch (error) {
      console.error('Error initializing WhatsApp:', error);
      alert('Error al inicializar WhatsApp: ' + error.message);
    }
  };

  const sendWhatsAppNotification = () => {
    if (!visitorName || !visitorPhone) {
      alert('Por favor ingresa el nombre y teléfono del visitante');
      return;
    }

    const message = `Está esperando ${visitorName}`;

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'whatsapp_send',
        phoneNumber: visitorPhone,
        text: message
      }));
    } else {
      alert('WebSocket no está conectado');
    }
  };

  return (
    <div className="app">
      {/* Escena 3D */}
      <div className="avatar-container">
        <Canvas camera={{ position: [0, 1, 2.5], fov: 45 }}>
          <ambientLight intensity={0.6} />
          <directionalLight position={[5, 5, 5]} intensity={1} />
          <Suspense fallback={null}>
            <Avatar3D audioLevel={audioLevel} lipSyncData={lipSyncData} />
            <Environment preset="apartment" background resolution={4096} backgroundBlurriness={0.0} />
          </Suspense>
          <OrbitControls
            enableZoom={false}
            enablePan={false}
            minPolarAngle={Math.PI / 3}
            maxPolarAngle={Math.PI / 2}
          />
        </Canvas>
      </div>

      {/* Controles */}
      <div className="controls">
        <div className="status">{status}</div>

        {!isConnected ? (
          <button className="btn connect-btn" onClick={connect}>
            Conectar
          </button>
        ) : (
          <div className="buttons">
            <button
              className={`btn mic-btn ${isRecording ? 'recording' : ''}`}
              onClick={toggleRecording}
            >
              {isRecording ? 'Detener' : 'Hablar'}
            </button>
            <button className="btn disconnect-btn" onClick={disconnect}>
              Desconectar
            </button>
          </div>
        )}

        {/* Indicador de audio */}
        <div className="audio-level">
          <div
            className="audio-level-bar"
            style={{ width: `${audioLevel * 100}%` }}
          />
        </div>

        {/* WhatsApp Controls */}
        {isConnected && (
          <div className="whatsapp-controls" style={{ marginTop: '20px' }}>
            {!whatsappStatus?.initialized ? (
              <button className="btn whatsapp-btn" onClick={initializeWhatsApp}>
                📱 Conectar WhatsApp
              </button>
            ) : whatsappStatus?.authenticated ? (
              <>
                <div style={{ color: '#25D366', fontSize: '14px', marginBottom: '10px' }}>
                  ✓ WhatsApp Conectado
                </div>
                <button
                  className="btn whatsapp-notify-btn"
                  onClick={() => setShowNotificationDialog(true)}
                >
                  📨 Notificar Visitante
                </button>
              </>
            ) : (
              <div style={{ color: '#FFA500', fontSize: '14px' }}>
                ⏳ Esperando autenticación...
              </div>
            )}
          </div>
        )}
      </div>

      {/* QR Code Modal */}
      {showQRModal && qrCode && (
        <div className="modal-overlay" onClick={() => setShowQRModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Escanea el código QR con WhatsApp</h2>
            <img src={`data:image/png;base64,${qrCode}`} alt="WhatsApp QR Code" style={{ width: '300px' }} />
            <p>Abre WhatsApp en tu teléfono → Menú → Dispositivos vinculados → Vincular dispositivo</p>
            <button className="btn" onClick={() => setShowQRModal(false)}>Cerrar</button>
          </div>
        </div>
      )}

      {/* Notification Dialog */}
      {showNotificationDialog && (
        <div className="modal-overlay" onClick={() => setShowNotificationDialog(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Notificar Visitante por WhatsApp</h2>
            <div style={{ padding: '20px 0' }}>
              <input
                type="text"
                placeholder="Nombre del visitante"
                value={visitorName}
                onChange={(e) => setVisitorName(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px',
                  marginBottom: '10px',
                  borderRadius: '5px',
                  border: '1px solid #ddd'
                }}
              />
              <input
                type="tel"
                placeholder="Teléfono (ej: +56912345678)"
                value={visitorPhone}
                onChange={(e) => setVisitorPhone(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px',
                  marginBottom: '10px',
                  borderRadius: '5px',
                  border: '1px solid #ddd'
                }}
              />
              <p style={{ fontSize: '12px', color: '#666' }}>
                Se enviará: "Está esperando {visitorName || '...'}"
              </p>
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button className="btn" onClick={() => setShowNotificationDialog(false)}>
                Cancelar
              </button>
              <button className="btn whatsapp-btn" onClick={sendWhatsAppNotification}>
                Enviar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
