import { useState, useRef, useCallback, useEffect, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment } from '@react-three/drei';
import Avatar3D from '../components/Avatar3D';
import useAudioAnalyzer from '../hooks/useAudioAnalyzer';
import '../App.css';

// Detectar móvil
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

function VisualPage() {
    const [isConnected, setIsConnected] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [status, setStatus] = useState('Desconectado');

    const wsRef = useRef(null);
    const audioContextRef = useRef(null);
    const mediaStreamRef = useRef(null);
    const processorRef = useRef(null);
    const audioQueueRef = useRef([]);
    const isPlayingRef = useRef(false);
    const isRecordingRef = useRef(false);

    const { audioLevel, setAudioLevel, lipSyncData, setLipSyncData, analyzeFrequencies } = useAudioAnalyzer();
    const scheduledEndTimeRef = useRef(0);
    const audioDataRef = useRef([]);

    const outputAnalyzerRef = useRef(null);
    const outputDataArrayRef = useRef(null);
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
        audioQueueRef.current = [];
        if (audioContextRef.current) {
            scheduledEndTimeRef.current = audioContextRef.current.currentTime;
        }
        setAudioLevel(0);
        setLipSyncData(null);
        isPlayingRef.current = false;
    }, [setAudioLevel, setLipSyncData]);

    // Reproducir audio con scheduling preciso
    const playAudioChunk = useCallback((base64Data) => {
        if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
            audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });
            scheduledEndTimeRef.current = audioContextRef.current.currentTime;
            outputAnalyzerRef.current = audioContextRef.current.createAnalyser();
            outputAnalyzerRef.current.fftSize = 1024;
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

            const samples = new Int16Array(bytes.buffer);
            audioDataRef.current.push({ samples, startTime: scheduledEndTimeRef.current });

            const floatSamples = new Float32Array(samples.length);
            for (let i = 0; i < samples.length; i++) {
                floatSamples[i] = samples[i] / 32768.0;
            }

            const audioBuffer = ctx.createBuffer(1, floatSamples.length, 24000);
            audioBuffer.copyToChannel(floatSamples, 0);

            const source = ctx.createBufferSource();
            source.buffer = audioBuffer;

            if (outputAnalyzerRef.current) {
                source.connect(outputAnalyzerRef.current);
                outputAnalyzerRef.current.connect(ctx.destination);
            } else {
                source.connect(ctx.destination);
            }

            const startTime = Math.max(ctx.currentTime, scheduledEndTimeRef.current);
            source.start(startTime);
            scheduledEndTimeRef.current = startTime + audioBuffer.duration;

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

    // Analizar audio continuamente mientras reproduce
    useEffect(() => {
        const interval = setInterval(() => {
            const ctx = audioContextRef.current;
            const analyzer = outputAnalyzerRef.current;

            if (ctx && analyzer && outputDataArrayRef.current) {
                analyzer.getByteFrequencyData(outputDataArrayRef.current);
                const lipSync = analyzeFrequencies(outputDataArrayRef.current, ctx.sampleRate);
                if (lipSync) {
                    setLipSyncData(lipSync);
                    if (lipSync.level > 0.01) {
                        setAudioLevel(lipSync.level);
                        return;
                    }
                }
            }

            if (ctx && audioDataRef.current.length > 0) {
                const currentTime = ctx.currentTime;
                if (audioDataRef.current.length > 20) {
                    audioDataRef.current = audioDataRef.current.filter(d => d.startTime + (d.samples.length / 24000) > currentTime - 1);
                }

                for (const data of audioDataRef.current) {
                    const duration = data.samples.length / 24000;
                    if (currentTime >= data.startTime && currentTime < data.startTime + duration) {
                        const offset = Math.floor((currentTime - data.startTime) * 24000);
                        const windowSize = Math.min(2400, data.samples.length - offset);
                        if (windowSize > 0) {
                            let sum = 0;
                            for (let i = 0; i < windowSize; i++) {
                                sum += data.samples[offset + i] * data.samples[offset + i];
                            }
                            const rms = Math.sqrt(sum / windowSize);
                            const level = Math.min(1, rms / 10000);
                            setAudioLevel(level);
                        } else {
                            setAudioLevel(0);
                        }
                        return;
                    }
                }
            }

            setAudioLevel(0);
            setLipSyncData(null);
        }, 30);

        return () => clearInterval(interval);
    }, [setAudioLevel, setLipSyncData, analyzeFrequencies]);

    // Reproducir chunk MP3 (ElevenLabs)
    const playMp3Chunk = useCallback(async (base64Data) => {
        if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
            audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });
            scheduledEndTimeRef.current = audioContextRef.current.currentTime;
            outputAnalyzerRef.current = audioContextRef.current.createAnalyser();
            outputAnalyzerRef.current.fftSize = 1024;
            outputAnalyzerRef.current.smoothingTimeConstant = 0.5;
            outputDataArrayRef.current = new Uint8Array(outputAnalyzerRef.current.frequencyBinCount);
        }

        const ctx = audioContextRef.current;

        try {
            const binaryString = atob(base64Data);
            const len = binaryString.length;
            const bytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }

            const audioBuffer = await ctx.decodeAudioData(bytes.buffer);
            const source = ctx.createBufferSource();
            source.buffer = audioBuffer;

            if (outputAnalyzerRef.current) {
                source.connect(outputAnalyzerRef.current);
                outputAnalyzerRef.current.connect(ctx.destination);
            } else {
                source.connect(ctx.destination);
            }

            const startTime = Math.max(ctx.currentTime, scheduledEndTimeRef.current);
            source.start(startTime);
            scheduledEndTimeRef.current = startTime + audioBuffer.duration;

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
            if (typeof item === 'object' && item.isMp3) {
                await playMp3Chunk(item.data);
            } else {
                const data = typeof item === 'string' ? item : item.data;
                playAudioChunk(data);
            }
        }
    }, [playAudioChunk, playMp3Chunk]);

    // Conectar WebSocket
    const connect = useCallback(async () => {
        try {
            setStatus('Conectando...');

            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                const isSecure = window.isSecureContext;
                const errorMsg = isSecure
                    ? 'Tu navegador no soporta acceso al micrófono.'
                    : 'El acceso al micrófono requiere HTTPS.';
                setStatus('Error: ' + errorMsg);
                return;
            }

            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    sampleRate: 16000,
                    channelCount: 1,
                    echoCancellation: true,
                    noiseSuppression: true
                }
            });
            mediaStreamRef.current = stream;

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
                    setStatus(`¡Conectado (${mode})! Habla para interactuar`);
                } else if (data.type === 'audio') {
                    audioQueueRef.current.push(data.data);
                    playAudioQueue();
                } else if (data.type === 'elevenlabs_audio') {
                    audioQueueRef.current.push({ data: data.data, isMp3: true });
                    playAudioQueue();
                } else if (data.type === 'text') {
                    console.log('📝 Gemini:', data.text);
                } else if (data.type === 'whatsapp_notification') {
                    window.open(data.url, '_blank');
                } else if (data.type === 'interrupted') {
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
    }, [playAudioQueue, stopPlayback]);

    // Procesar y enviar audio del micrófono
    const startRecording = useCallback(async () => {
        if (!mediaStreamRef.current || !wsRef.current) {
            return;
        }

        isRecordingRef.current = true;
        setIsRecording(true);
        setStatus('Escuchando...');

        const audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
        const source = audioContext.createMediaStreamSource(mediaStreamRef.current);
        const processor = audioContext.createScriptProcessor(4096, 1, 1);
        processorRef.current = { audioContext, processor };

        // Buffer de tiempo para evitar eco residual después de que el avatar termina de hablar
        let lastAvatarSpeakTime = 0;
        const ECHO_BUFFER_MS = 600; // Esperar 600ms después de que el avatar termine

        processor.onaudioprocess = (event) => {
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

            // Verificar si estamos en el buffer de eco (avatar terminó recientemente)
            const timeSinceAvatarSpoke = Date.now() - lastAvatarSpeakTime;
            const inEchoBuffer = lastAvatarSpeakTime > 0 && timeSinceAvatarSpoke < ECHO_BUFFER_MS;

            // BLOQUEO TOTAL: Si el avatar está hablando, NO enviar audio (excepto barge-in fuerte)
            if (isAvatarSpeaking) {
                // Solo permitir barge-in si el usuario habla MUY fuerte (interrupción intencional)
                const BARGE_IN_THRESHOLD = 0.15; // Muy alto para evitar eco
                if (rms < BARGE_IN_THRESHOLD) {
                    return; // Ignorar - es eco del avatar
                }
            }

            // BUFFER DE ECO: Después de que el avatar termina, esperar un poco
            if (inEchoBuffer) {
                const RECOVERY_THRESHOLD = 0.08; // Umbral medio durante recuperación
                if (rms < RECOVERY_THRESHOLD) {
                    return; // Ignorar - posible eco residual
                }
            }

            // Umbral normal cuando no hay eco
            const NORMAL_THRESHOLD = 0.008;
            if (rms < NORMAL_THRESHOLD) {
                return; // Silencio, no enviar
            }

            const pcmData = new Int16Array(inputData.length);
            for (let i = 0; i < inputData.length; i++) {
                pcmData[i] = Math.max(-32768, Math.min(32767, inputData[i] * 32768));
            }

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
        isRecordingRef.current = false;
        if (processorRef.current) {
            processorRef.current.processor.disconnect();
            processorRef.current.audioContext.close();
            processorRef.current = null;
        }
        setIsRecording(false);
    }, []);

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
            startRecording();
        }
    }, [isConnected, isRecording, startRecording]);

    return (
        <div className="app">
            {/* Escena 3D */}
            <div className="avatar-container">
                <Canvas
                    camera={{ position: [0, 1, 2.5], fov: 45 }}
                    gl={{
                        antialias: !isMobile, // Desactivar antialiasing en móvil
                        powerPreference: isMobile ? 'low-power' : 'high-performance',
                        pixelRatio: isMobile ? 1 : Math.min(window.devicePixelRatio, 2) // Menor resolución en móvil
                    }}
                    shadows={!isMobile} // Sin sombras en móvil
                    dpr={isMobile ? [1, 1] : [1, 2]} // Pixel ratio fijo en móvil
                >
                    <ambientLight intensity={0.6} />
                    <directionalLight position={[5, 5, 5]} intensity={1} castShadow={!isMobile} />
                    <Suspense fallback={null}>
                        <Avatar3D audioLevel={audioLevel} lipSyncData={lipSyncData} />
                        <Environment
                            preset="apartment"
                            background
                            resolution={isMobile ? 1024 : 2048}
                            backgroundBlurriness={0.0}
                        />
                    </Suspense>
                    <OrbitControls
                        enableZoom={false}
                        enablePan={false}
                        minPolarAngle={Math.PI / 3}
                        maxPolarAngle={Math.PI / 2}
                    />
                </Canvas>
            </div>

            {/* Controles mínimos */}
            <div className="controls" style={{ minHeight: 'auto', padding: '10px' }}>
                <div className="status">{status}</div>
                <div className="audio-level">
                    <div
                        className="audio-level-bar"
                        style={{ width: `${audioLevel * 100}%` }}
                    />
                </div>
            </div>
        </div>
    );
}

export default VisualPage;
