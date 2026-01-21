import { Link } from 'react-router-dom';
import { useState, useRef, useCallback, useEffect, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment } from '@react-three/drei';
import Avatar3D from '../components/Avatar3D';
import WebGLErrorBoundary from '../components/WebGLErrorBoundary';
import useAudioAnalyzer from '../hooks/useAudioAnalyzer';
import useGeminiSpanishLipSync from '../hooks/useGeminiSpanishLipSync';
import '../App.css';

function HomePage() {
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

  // AudioWorklet-based Spanish Lip-Sync
  const lipSyncWorkletRef = useRef(null);
  const lipSyncInitializedRef = useRef(false);
  const { lipSyncState, setWorkletNode, reset: resetLipSync } = useGeminiSpanishLipSync();

  // === FUNCIONES DE PRUEBA PARA CONSOLA ===
  useEffect(() => {
    // Función para simular lip sync con texto
    window.testLipSync = (text = "Hola, esto es una prueba de lip sync") => {
      console.log('🎵 Iniciando prueba de lip sync:', text);
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
        console.log('📡 Enviando texto a Gemini:', text);
        wsRef.current.send(JSON.stringify({
          type: 'text',
          text: text
        }));
      } else {
        console.error('❌ WebSocket no conectado. Espera a que se conecte.');
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
      console.log('🎡 Boca abierta a:', value);
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
      console.log('⏩️ Escribe stopScan() para detener');

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
        console.log(`📌 Probando índice ${current}...`);
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

    console.log('🔺 Funciones de debug de morphs:');
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

    console.log('🔇 Reproducción interrumpida y cola limpiada');
  }, [setAudioLevel, setLipSyncData]);

  // Reproducir audio con scheduling preciso + AudioWorklet Lip-Sync
  const playAudioChunk = useCallback(async (base64Data) => {
    if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: 24000,
        latencyHint: 'interactive' // Low latency mode
      });
      scheduledEndTimeRef.current = audioContextRef.current.currentTime;

      // Initialize AudioWorklet for lip-sync (replaces AnalyserNode)
      if (!lipSyncInitializedRef.current) {
        try {
          await audioContextRef.current.audioWorklet.addModule('/worklets/LipSyncProcessor.js');
          lipSyncWorkletRef.current = new AudioWorkletNode(audioContextRef.current, 'lip-sync-processor', {
            numberOfInputs: 1,
            numberOfOutputs: 1,
            outputChannelCount: [1]
          });
          lipSyncWorkletRef.current.connect(audioContextRef.current.destination);

          // Connect to Spanish Lip-Sync hook
          setWorkletNode(lipSyncWorkletRef.current);

          lipSyncInitializedRef.current = true;
          console.log('\u2705 AudioWorklet LipSyncProcessor initialized');
        } catch (error) {
          console.error('\u274C Error initializing AudioWorklet:', error);
          // Fallback: connect directly to destination
        }
      }
    }

    const ctx = audioContextRef.current;

    try {
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // PCM Int16 a Float32
      const samples = new Int16Array(bytes.buffer);
      const floatSamples = new Float32Array(samples.length);
      for (let i = 0; i < samples.length; i++) {
        floatSamples[i] = samples[i] / 32768.0;
      }

      const audioBuffer = ctx.createBuffer(1, floatSamples.length, 24000);
      audioBuffer.copyToChannel(floatSamples, 0);

      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;

      // Connect: Source -> AudioWorklet -> Speakers
      if (lipSyncWorkletRef.current) {
        source.connect(lipSyncWorkletRef.current);
        // Worklet is already connected to destination
      } else {
        source.connect(ctx.destination);
      }

      // Calculate RMS for audioLevel (simple approach for visualization)
      let sumSquares = 0;
      for (let i = 0; i < floatSamples.length; i++) {
        sumSquares += floatSamples[i] * floatSamples[i];
      }
      const rms = Math.sqrt(sumSquares / floatSamples.length);
      setAudioLevel(Math.min(1, rms * 5)); // Boost for visibility

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
          setAudioLevel(0);
        }
      };

    } catch (error) {
      console.error('Error audio:', error);
    }
  }, [setAudioLevel]);

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

    }, 20); // 20ms (~50fps) para baja latencia y respuesta rápida

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
          alert('✅ Mensaje enviado correctamente');
          setShowNotificationDialog(false);
          setVisitorName('');
          setVisitorPhone('');
        } else if (data.type === 'whatsapp_error') {
          alert('Error enviando mensaje: ' + data.error);
        } else if (data.type === 'command_response') {
          // Respuesta de comando - usar TTS del navegador
          console.log('🎯 Comando ejecutado:', data.text);

          // Reproducir con TTS del navegador
          if (data.useTTS && browserTTSRef.current) {
            browserTTSRef.current.speak(data.text).catch(err => {
              console.error('Error en Browser TTS:', err);
            });
          }
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

  // Speech Recognition Ref
  const recognitionRef = useRef(null);

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

    // === INICIAR WEB SPEECH API (STT CLIENTE) ===
    if ('webkitSpeechRecognition' in window) {
      console.log('🎤 Iniciando reconocimiento de voz (Client-Side STT)...');
      const recognition = new window.webkitSpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = false;
      recognition.lang = 'es-ES';

      recognition.onresult = (event) => {
        const transcript = event.results[event.results.length - 1][0].transcript;
        console.log('🎤 STT Final:', transcript);

        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({
            type: 'client_transcript', // Nuevo tipo de mensaje para el server
            text: transcript
          }));
        }
      };

      recognition.onerror = (event) => {
        // Suppress harmless "no-speech" warnings - they're expected when user isn't speaking
        if (event.error !== 'no-speech') {
          console.warn('⚠️ Error en Speech Recognition:', event.error);
        }
      };

      try {
        recognition.start();
        recognitionRef.current = recognition;
      } catch (e) {
        console.error("Error al iniciar recognition:", e);
      }
    } else {
      console.warn("⚠️ Web Speech API no soportada en este navegador.");
    }


    const audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
    const source = audioContext.createMediaStreamSource(mediaStreamRef.current);

    // Usar ScriptProcessor para capturar audio
    const processor = audioContext.createScriptProcessor(4096, 1, 1);
    processorRef.current = { audioContext, processor };

    // Buffer de tiempo para evitar eco residual después de que el avatar termina de hablar
    let lastAvatarSpeakTime = 0;

    processor.onaudioprocess = (event) => {
      // Usar ref en lugar de state para el check
      if (!isRecordingRef.current) return;

      const inputData = event.inputBuffer.getChannelData(0);

      // === ECHO CANCELLATION MEJORADO ===

      // Calcular volumen del input (mic)
      let sum = 0;
      for (let i = 0; i < inputData.length; i++) {
        sum += inputData[i] * inputData[i];
      }
      const rms = Math.sqrt(sum / inputData.length);

      // Detectar si el avatar está hablando
      const currentTime = audioContextRef.current?.currentTime || 0;
      const isAvatarSpeaking = isPlayingRef.current && scheduledEndTimeRef.current > currentTime;

      // Si el avatar está hablando, actualizar el timestamp
      if (isAvatarSpeaking) {
        lastAvatarSpeakTime = Date.now();
      }

      // BUFFER DE ECO: Solo bloquear si el avatar está hablando activamente
      // Eliminado ECHO_BUFFER_MS para respuesta más rápida

      // BLOQUEO TOTAL: Si el avatar está hablando, NO enviar audio (Half-Duplex estricto)
      if (isAvatarSpeaking) {
        return; // Silencio absoluto del mic durante reproducción
      }

      // Umbral normal cuando no hay eco
      const NORMAL_THRESHOLD = 0.02; // Ajustado para filtrar ruido ambiente

      // === DIGITAL NOISE GATE ===
      // Si el volumen es menor al umbral, enviamos SILENCIO (zeros)
      // Esto es CRÍTICO para que el VAD de Gemini detecte que "dejaste de hablar"
      // Si simplemente cortamos el envío (return), Gemini se queda esperando.

      let pcmData;

      if (rms < NORMAL_THRESHOLD) {
        // Enviar silencio absoluto (zeros)
        pcmData = new Int16Array(inputData.length); // Se inicializa en 0 por defecto
      } else {
        // Enviar audio real
        pcmData = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          pcmData[i] = Math.max(-32768, Math.min(32767, inputData[i] * 32768));
        }
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

    // Detener Web Speech API
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
        console.log('🎤 Reconocimiento de voz detenido.');
      } catch (e) {
        console.warn('Error al detener recognition:', e);
      }
      recognitionRef.current = null;
    }

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
        console.log('Status is waiting_qr, fetching QR code...');
        // Obtener QR code
        const qrResponse = await fetch('http://localhost:3000/api/whatsapp/qr');
        const qrData = await qrResponse.json();
        console.log('QR Response data:', qrData ? 'Data received' : 'No data');

        if (qrData.qr) {
          console.log('QR Code received, setting state...');
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
        } else {
          console.warn('QR Data has no qr property:', qrData);
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
      {/* Iconos discretos en esquinas superiores */}
      <div style={{
        position: 'fixed',
        top: '15px',
        left: '15px',
        zIndex: 100,
        display: 'flex',
        gap: '10px'
      }}>
        {/* Config Icon */}
        <Link
          to="/config"
          title="Configuración"
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            textDecoration: 'none',
            fontSize: '18px',
            transition: 'background 0.2s',
            backdropFilter: 'blur(5px)'
          }}
          onMouseEnter={(e) => e.target.style.background = 'rgba(255,255,255,0.2)'}
          onMouseLeave={(e) => e.target.style.background = 'rgba(0,0,0,0.5)'}
        >
          ⚙️
        </Link>
      </div>

      <div style={{
        position: 'fixed',
        top: '15px',
        right: '15px',
        zIndex: 100,
        display: 'flex',
        gap: '8px',
        alignItems: 'center'
      }}>
        {/* WhatsApp Icon + Status */}
        {isConnected && (
          <>
            {!whatsappStatus?.initialized ? (
              <>
                <span style={{
                  fontSize: '11px',
                  color: 'rgba(255,255,255,0.6)',
                  background: 'rgba(0,0,0,0.4)',
                  padding: '4px 8px',
                  borderRadius: '12px',
                  backdropFilter: 'blur(5px)'
                }}>
                  WA: Desconectado
                </span>
                <button
                  onClick={initializeWhatsApp}
                  title="Conectar WhatsApp"
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    background: 'rgba(0,0,0,0.5)',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '18px',
                    cursor: 'pointer',
                    transition: 'background 0.2s',
                    backdropFilter: 'blur(5px)'
                  }}
                  onMouseEnter={(e) => e.target.style.background = 'rgba(37,211,102,0.3)'}
                  onMouseLeave={(e) => e.target.style.background = 'rgba(0,0,0,0.5)'}
                >
                  📱
                </button>
              </>
            ) : whatsappStatus?.authenticated ? (
              <>
                <span style={{
                  fontSize: '11px',
                  color: '#25D366',
                  background: 'rgba(37,211,102,0.2)',
                  padding: '4px 8px',
                  borderRadius: '12px',
                  backdropFilter: 'blur(5px)'
                }}>
                  ✓ WA Conectado
                </span>
                <button
                  onClick={() => setShowNotificationDialog(true)}
                  title="Notificar Visitante"
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    background: 'rgba(37,211,102,0.3)',
                    border: '2px solid #25D366',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '18px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    backdropFilter: 'blur(5px)'
                  }}
                  onMouseEnter={(e) => e.target.style.background = 'rgba(37,211,102,0.5)'}
                  onMouseLeave={(e) => e.target.style.background = 'rgba(37,211,102,0.3)'}
                >
                  📬
                </button>
              </>
            ) : (
              <>
                <span style={{
                  fontSize: '11px',
                  color: '#FFA500',
                  background: 'rgba(255,165,0,0.2)',
                  padding: '4px 8px',
                  borderRadius: '12px',
                  backdropFilter: 'blur(5px)'
                }}>
                  Esperando QR...
                </span>
                <button
                  onClick={initializeWhatsApp}
                  title="Clic para ver código QR"
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    background: 'rgba(255,165,0,0.3)',
                    border: '2px solid #FFA500',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '18px',
                    backdropFilter: 'blur(5px)',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => e.target.style.background = 'rgba(255,165,0,0.5)'}
                  onMouseLeave={(e) => e.target.style.background = 'rgba(255,165,0,0.3)'}
                >
                  ⏳
                </button>
              </>
            )}
          </>
        )}
      </div>

      {/* Escena 3D */}
      <div className="avatar-container">
        <WebGLErrorBoundary>
          <Canvas
            camera={{ position: [0, 1, 2.5], fov: 45 }}
            gl={{
              powerPreference: "low-power",
              antialias: false,
              alpha: false,
              preserveDrawingBuffer: false,
              failIfMajorPerformanceCaveat: false,
              stencil: false,
              depth: true
            }}
            onCreated={({ gl }) => {
              // Configure renderer for better stability
              gl.setClearColor('#000000', 1);
              console.log('✅ WebGL Renderer created successfully');
            }}
            onError={(error) => {
              console.error('❌ Canvas error:', error);
            }}
          >
            <ambientLight intensity={0.6} />
            <directionalLight position={[5, 5, 5]} intensity={1} />
            <Suspense fallback={null}>
              <Avatar3D audioLevel={audioLevel} lipSyncData={lipSyncState} />
              <Environment files="/background.jpg" background />
            </Suspense>
            <OrbitControls
              enableZoom={false}
              enablePan={false}
              minPolarAngle={Math.PI / 3}
              maxPolarAngle={Math.PI / 2}
            />
          </Canvas>
        </WebGLErrorBoundary>
      </div>

      {/* Controles mínimos en la parte inferior */}
      <div className="controls" style={{ minHeight: 'auto', padding: '15px' }}>
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

export default HomePage;


