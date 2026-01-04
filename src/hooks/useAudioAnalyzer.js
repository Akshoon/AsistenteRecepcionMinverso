import { useRef, useCallback, useState } from 'react';

export default function useAudioAnalyzer() {
    const audioContextRef = useRef(null);
    const analyzerRef = useRef(null);
    const dataArrayRef = useRef(null);
    const [audioLevel, setAudioLevel] = useState(0);
    const [lipSyncData, setLipSyncData] = useState({
        mouthOpen: 0,      // Apertura vertical de boca (vocales)
        mouthWide: 0,      // Ancho de boca (sonrisas, "e", "i")
        jawOpen: 0,        // Apertura de mandíbula
        tongueOut: 0,      // Para sonidos como "th"
        lipsPursed: 0,     // Labios fruncidos ("o", "u")
    });
    const animationFrameRef = useRef(null);

    // Inicializar analizador de audio con más detalle
    const initAnalyzer = useCallback(() => {
        if (!audioContextRef.current) {
            audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
            analyzerRef.current = audioContextRef.current.createAnalyser();
            analyzerRef.current.fftSize = 512; // Más resolución para lip sync
            analyzerRef.current.smoothingTimeConstant = 0.6; // Menos suavizado para respuesta rápida
            dataArrayRef.current = new Uint8Array(analyzerRef.current.frequencyBinCount);
        }
        return {
            audioContext: audioContextRef.current,
            analyzer: analyzerRef.current
        };
    }, []);

    // Conectar audio (para reproducción de respuesta)
    const connectAudio = useCallback((audioElement) => {
        const { audioContext, analyzer } = initAnalyzer();
        const source = audioContext.createMediaElementSource(audioElement);
        source.connect(analyzer);
        analyzer.connect(audioContext.destination);
        return source;
    }, [initAnalyzer]);

    // Analizar frecuencias para lip sync con detección mejorada de visemas
    const analyzeFrequencies = useCallback((frequencyData, sampleRate = 24000) => {
        if (!frequencyData || frequencyData.length === 0) return null;

        const binCount = frequencyData.length;
        const nyquist = sampleRate / 2;
        const binWidth = nyquist / binCount;

        // Rangos de frecuencias optimizados para detección de fonemas
        const getEnergyInRange = (lowHz, highHz) => {
            const lowBin = Math.floor(lowHz / binWidth);
            const highBin = Math.min(Math.ceil(highHz / binWidth), binCount - 1);
            let sum = 0;
            let count = 0;
            for (let i = lowBin; i <= highBin; i++) {
                sum += frequencyData[i];
                count++;
            }
            return count > 0 ? sum / count / 255 : 0;
        };

        // Energías en diferentes bandas (más precisas)
        const lowEnergy = getEnergyInRange(80, 300);       // Fundamentales vocálicas
        const f1Energy = getEnergyInRange(300, 900);       // Formante 1 - apertura mandíbula
        const f2Energy = getEnergyInRange(900, 2800);      // Formante 2 - posición lengua/ancho
        const f3Energy = getEnergyInRange(2800, 3500);     // Formante 3 - diferenciación vocal
        const highEnergy = getEnergyInRange(3500, 8000);   // Fricativas/sibilantes

        // Cálculo EQUILIBRADO de visemas - Visibles pero suaves
        let mouthOpen, mouthWide, jawOpen, lipsPursed, tongueOut;

        // Simplificamos a solo 3 casos principales para evitar cambios bruscos

        // Vocal abierta (aa/Ah) - F1 alto
        if (f1Energy > 0.6) {
            mouthOpen = Math.min(0.8, f1Energy * 1.1);  // Aumentado para visibilidad
            jawOpen = Math.min(0.7, f1Energy * 0.95);   // Aumentado
            mouthWide = f2Energy * 0.3;
            lipsPursed = 0;
        }
        // Vocal ancha/sonrisa (I/E) - F2 alto
        else if (f2Energy > 0.6) {
            mouthOpen = Math.min(0.6, f1Energy * 0.8);  // Aumentado
            jawOpen = f1Energy * 0.65;
            mouthWide = Math.min(0.8, f2Energy * 0.95); // Aumentado
            lipsPursed = 0;
        }
        // Vocal redondeada (O/U) - F2 bajo
        else if (f2Energy < 0.35 && lowEnergy > 0.3) {
            mouthOpen = f1Energy * 0.75;
            jawOpen = f1Energy * 0.65;
            mouthWide = 0;
            lipsPursed = Math.min(0.8, (0.35 - f2Energy) * 1.8);  // Aumentado
        }
        // Por defecto - movimiento visible
        else {
            mouthOpen = Math.min(0.7, f1Energy * 0.85);  // Aumentado
            jawOpen = Math.min(0.6, (lowEnergy + f1Energy) * 0.55);  // Aumentado
            mouthWide = Math.min(0.7, f2Energy * 0.7);  // Aumentado
            lipsPursed = Math.max(0, (lowEnergy * 0.45 - f2Energy * 0.2));  // Aumentado
        }

        // Consonantes - reducidas pero visibles
        if (highEnergy > 0.7) {
            mouthOpen = Math.min(mouthOpen, 0.3);  // Limitar apertura
            mouthWide = Math.max(mouthWide, 0.4);   // Mínimo ancho
        }

        tongueOut = 0;  // DESACTIVADO

        return {
            mouthOpen: Math.max(0, Math.min(1, mouthOpen)),
            mouthWide: Math.max(0, Math.min(1, mouthWide)),
            jawOpen: Math.max(0, Math.min(1, jawOpen)),
            lipsPursed: Math.max(0, Math.min(1, lipsPursed)),
            tongueOut: Math.max(0, Math.min(1, tongueOut)),
            // Datos adicionales para debug
            formants: { f1Energy, f2Energy, f3Energy, highEnergy, lowEnergy },
            level: Math.min(1, (lowEnergy + f1Energy + f2Energy) / 2.5)
        };
    }, []);

    // Analizar buffer de audio PCM directamente con lip sync
    const analyzeBuffer = useCallback((pcmData, sampleRate = 24000) => {
        if (!pcmData || pcmData.length === 0) return 0;

        // Calcular RMS (volumen) del buffer PCM
        let sum = 0;
        const samples = new Int16Array(pcmData.buffer || pcmData);
        for (let i = 0; i < samples.length; i++) {
            sum += samples[i] * samples[i];
        }
        const rms = Math.sqrt(sum / samples.length);
        const normalized = Math.min(1, rms / 8000);

        // Análisis simple de frecuencia usando cruces por cero (aproximación)
        let zeroCrossings = 0;
        for (let i = 1; i < samples.length; i++) {
            if ((samples[i] >= 0) !== (samples[i - 1] >= 0)) {
                zeroCrossings++;
            }
        }
        const zcr = zeroCrossings / samples.length;

        // Aproximar lip sync basado en volumen y ZCR
        // Alto ZCR = sonidos agudos/consonantes, bajo ZCR = vocales
        const isVowel = zcr < 0.15 && normalized > 0.1;
        const isConsonant = zcr > 0.25 && normalized > 0.05;

        const lipSync = {
            mouthOpen: isVowel ? normalized * 1.2 : normalized * 0.6,
            mouthWide: isConsonant ? normalized * 0.8 : normalized * 0.3,
            jawOpen: normalized * 0.9,
            lipsPursed: isVowel && zcr < 0.08 ? normalized * 0.5 : 0,
            tongueOut: 0
        };

        setAudioLevel(normalized);
        setLipSyncData(lipSync);

        return normalized;
    }, []);

    // Iniciar análisis continuo con lip sync
    const startAnalyzing = useCallback(() => {
        const { analyzer } = initAnalyzer();

        const analyze = () => {
            if (dataArrayRef.current && analyzerRef.current) {
                analyzerRef.current.getByteFrequencyData(dataArrayRef.current);

                // Calcular nivel promedio
                let sum = 0;
                for (let i = 0; i < dataArrayRef.current.length; i++) {
                    sum += dataArrayRef.current[i];
                }
                const avg = sum / dataArrayRef.current.length;
                const normalized = avg / 255;

                setAudioLevel(normalized);

                // Análisis de lip sync
                const lipSync = analyzeFrequencies(
                    dataArrayRef.current,
                    audioContextRef.current?.sampleRate || 24000
                );
                if (lipSync) {
                    setLipSyncData(lipSync);
                }
            }
            animationFrameRef.current = requestAnimationFrame(analyze);
        };

        analyze();
    }, [initAnalyzer, analyzeFrequencies]);

    // Detener análisis
    const stopAnalyzing = useCallback(() => {
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
        }
        setAudioLevel(0);
        setLipSyncData({
            mouthOpen: 0,
            mouthWide: 0,
            jawOpen: 0,
            tongueOut: 0,
            lipsPursed: 0,
        });
    }, []);

    // Limpiar recursos
    const cleanup = useCallback(() => {
        stopAnalyzing();
        if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
            audioContextRef.current.close();
        }
    }, [stopAnalyzing]);

    return {
        audioLevel,
        setAudioLevel,
        lipSyncData,
        setLipSyncData,
        initAnalyzer,
        connectAudio,
        analyzeBuffer,
        analyzeFrequencies,
        startAnalyzing,
        stopAnalyzing,
        cleanup
    };
}

