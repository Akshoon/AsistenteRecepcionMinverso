import { useState, useRef, useCallback, useEffect, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment } from '@react-three/drei';
import Avatar3D from '../components/Avatar3D';
import '../App.css';

// Detectar móvil
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

function VisualPage() {
    const [isConnected, setIsConnected] = useState(false);
    const [status, setStatus] = useState('Desconectado');

    const wsRef = useRef(null);
    const audioContextRef = useRef(null);
    const mediaStreamRef = useRef(null);
    const processorRef = useRef(null);
    const audioQueueRef = useRef([]);
    const isPlayingRef = useRef(false);
    const isRecordingRef = useRef(false);

    const scheduledEndTimeRef = useRef(0);
    const audioDataRef = useRef([]);

    const outputAnalyzerRef = useRef(null);
    const outputDataArrayRef = useRef(null);
    const currentSourceRef = useRef(null);

    // NEW: Audio Stream Destination for Hook
    const audioDestinationRef = useRef(null);
    const [outputStream, setOutputStream] = useState(null);

    // NEW: DOM refs for fast updates
    const audioBarRef = useRef(null);

    // Detener reproducción actual (Interrupción)
    const stopPlayback = useCallback(() => {
        if (currentSourceRef.current) {
            try {
                currentSourceRef.current.stop();
            } catch (e) { }
            currentSourceRef.current = null;
        }
        audioQueueRef.current = [];
        if (audioContextRef.current) {
            scheduledEndTimeRef.current = audioContextRef.current.currentTime;
        }
        isPlayingRef.current = false;
        if (audioBarRef.current) audioBarRef.current.style.width = '0%';
    }, []);

    // Reproducir audio con scheduling preciso
    const playAudioChunk = useCallback((base64Data) => {
        if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
            audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });
            scheduledEndTimeRef.current = audioContextRef.current.currentTime;

            // Setup Output Analysis & Routing
            outputAnalyzerRef.current = audioContextRef.current.createAnalyser();
            outputAnalyzerRef.current.fftSize = 512; // Even lower for efficiency

            // Setup Destination for Avatar Hook
            audioDestinationRef.current = audioContextRef.current.createMediaStreamDestination();
            setOutputStream(audioDestinationRef.current.stream);

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
                floatSamples[i] = samples[i] * 0.000030517578125; // 1/32768
            }

            const audioBuffer = ctx.createBuffer(1, floatSamples.length, 24000);
            audioBuffer.copyToChannel(floatSamples, 0);

            const source = ctx.createBufferSource();
            source.buffer = audioBuffer;

            // Route: Source -> Analyzer -> Destination (Avatar Hook) & Speakers
            source.connect(outputAnalyzerRef.current);
            outputAnalyzerRef.current.connect(audioDestinationRef.current);
            outputAnalyzerRef.current.connect(ctx.destination);

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

    // AGGRESSIVE: Direct DOM Analysis Loop (Bypass React state for level bar)
    useEffect(() => {
        let frame;
        const checkLevel = () => {
            const ctx = audioContextRef.current;
            const analyzer = outputAnalyzerRef.current;
            const bar = audioBarRef.current;

            if (ctx && analyzer && bar && isPlayingRef.current) {
                analyzer.getByteFrequencyData(outputDataArrayRef.current);
                let sum = 0;
                const data = outputDataArrayRef.current;
                for (let i = 0; i < data.length; i++) sum += data[i];
                const level = (sum / data.length) / 255;

                // Direct DOM update - No re-renders!
                bar.style.width = `${Math.min(100, level * 200)}%`;
            } else if (bar && !isPlayingRef.current) {
                bar.style.width = '0%';
            }
            frame = requestAnimationFrame(checkLevel);
        };
        checkLevel();
        return () => cancelAnimationFrame(frame);
    }, []);

    // Reproducir chunk MP3 (ElevenLabs)
    const playMp3Chunk = useCallback(async (base64Data) => {
        if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
            audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });
            scheduledEndTimeRef.current = audioContextRef.current.currentTime;
            outputAnalyzerRef.current = audioContextRef.current.createAnalyser();
            outputAnalyzerRef.current.fftSize = 512;
            audioDestinationRef.current = audioContextRef.current.createMediaStreamDestination();
            setOutputStream(audioDestinationRef.current.stream);
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

            source.connect(outputAnalyzerRef.current);
            outputAnalyzerRef.current.connect(audioDestinationRef.current);
            outputAnalyzerRef.current.connect(ctx.destination);

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
                setStatus('Error: Microfono no soportado o requiere HTTPS');
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

            ws.onopen = () => setStatus('Esperando conexión...');

            ws.onmessage = (event) => {
                const data = JSON.parse(event.data);
                if (data.type === 'connected') {
                    setIsConnected(true);
                    setStatus(`¡Conectado! Habla para interactuar`);
                } else if (data.type === 'audio' || data.type === 'elevenlabs_audio') {
                    audioQueueRef.current.push(data.type === 'audio' ? data.data : { data: data.data, isMp3: true });
                    playAudioQueue();
                } else if (data.type === 'whatsapp_notification') {
                    window.open(data.url, '_blank');
                } else if (data.type === 'interrupted') {
                    stopPlayback();
                }
            };

            ws.onerror = () => { setStatus('Error de conexión'); setIsConnected(false); };
            ws.onclose = () => { setStatus('Desconectado'); setIsConnected(false); };

        } catch (error) {
            console.error('Error:', error);
            setStatus('Error: ' + error.message);
        }
    }, [playAudioQueue, stopPlayback]);

    // Procesar y enviar audio del micrófono
    const startRecording = useCallback(async () => {
        if (!mediaStreamRef.current || !wsRef.current) return;

        isRecordingRef.current = true;
        setStatus('Escuchando...');

        const audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
        const source = audioContext.createMediaStreamSource(mediaStreamRef.current);
        const processor = audioContext.createScriptProcessor(4096, 1, 1);
        processorRef.current = { audioContext, processor };

        let lastAvatarSpeakTime = 0;
        const ECHO_BUFFER_MS = 600;

        processor.onaudioprocess = (event) => {
            if (!isRecordingRef.current) return;
            const inputData = event.inputBuffer.getChannelData(0);

            // Simple RMS
            let sum = 0;
            for (let i = 0; i < inputData.length; i++) sum += inputData[i] * inputData[i];
            const rms = Math.sqrt(sum / inputData.length);

            const isAvatarSpeaking = isPlayingRef.current;
            if (isAvatarSpeaking) lastAvatarSpeakTime = Date.now();

            const timeSinceAvatarSpoke = Date.now() - lastAvatarSpeakTime;
            const inEchoBuffer = lastAvatarSpeakTime > 0 && timeSinceAvatarSpoke < ECHO_BUFFER_MS;

            if (isAvatarSpeaking && rms < 0.15) return;
            if (inEchoBuffer && rms < 0.08) return;
            if (rms < 0.008) return;

            const pcmData = new Int16Array(inputData.length);
            for (let i = 0; i < inputData.length; i++) {
                pcmData[i] = Math.max(-32768, Math.min(32767, inputData[i] * 32768));
            }

            const uint8Array = new Uint8Array(pcmData.buffer);
            let binary = '';
            for (let i = 0; i < uint8Array.length; i++) binary += String.fromCharCode(uint8Array[i]);

            if (wsRef.current?.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify({ type: 'audio', data: btoa(binary) }));
            }
        };

        source.connect(processor);
        processor.connect(audioContext.destination);
    }, []);

    // Limpieza
    const disconnect = useCallback(() => {
        if (wsRef.current) wsRef.current.close();
        if (mediaStreamRef.current) mediaStreamRef.current.getTracks().forEach(track => track.stop());
        if (processorRef.current) {
            processorRef.current.processor.disconnect();
            processorRef.current.audioContext.close();
            processorRef.current = null;
        }
        isRecordingRef.current = false;
        setIsConnected(false);
    }, []);

    useEffect(() => { disconnect(); connect(); return () => disconnect(); }, [connect, disconnect]);
    useEffect(() => { if (isConnected) startRecording(); }, [isConnected, startRecording]);

    return (
        <div className="app">
            <div className="avatar-container">
                <Canvas
                    camera={{ position: [0, 1, 2.5], fov: 45, near: 0.01 }}
                    gl={{
                        antialias: false,
                        powerPreference: 'low-power',
                        pixelRatio: 1
                    }}
                    shadows={false}
                    dpr={1}
                >
                    <ambientLight intensity={0.6} />
                    <directionalLight position={[5, 5, 5]} intensity={1} />
                    <Suspense fallback={null}>
                        <Avatar3D
                            audioStream={outputStream}
                            modelPath={isMobile ? '/avataralt.glb' : '/avataralt.glb'} // Force light model even on desktop for stability
                        />
                        <Environment preset="apartment" background resolution={256} />
                    </Suspense>
                    <OrbitControls enableZoom={false} enablePan={false} minPolarAngle={Math.PI / 3} maxPolarAngle={Math.PI / 2} />
                </Canvas>
            </div>

            <div className="controls" style={{ minHeight: 'auto', padding: '10px' }}>
                <div className="status">{status}</div>
                <div className="audio-level">
                    <div ref={audioBarRef} className="audio-level-bar" style={{ width: '0%' }} />
                </div>
            </div>
        </div>
    );
}

export default VisualPage;
