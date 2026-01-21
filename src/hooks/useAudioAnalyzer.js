import { useRef, useCallback, useState } from 'react';

export default function useAudioAnalyzer() {
    const audioContextRef = useRef(null);
    const analyzerRef = useRef(null);
    const dataArrayRef = useRef(null);
    const [audioLevel, setAudioLevel] = useState(0);
    const [lipSyncData, setLipSyncData] = useState({
        visemes: {},       // Pesos crudos de visemas
        mouthOpen: 0,      // Legacy support
        mouthWide: 0,
        jawOpen: 0,
        tongueOut: 0,
        lipsPursed: 0,
    });
    const animationFrameRef = useRef(null);

    // Inicializar analizador de audio con más detalle
    const initAnalyzer = useCallback(() => {
        if (!audioContextRef.current) {
            audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
            analyzerRef.current = audioContextRef.current.createAnalyser();
            analyzerRef.current.fftSize = 1024; // Mayor resolución para formantes precisos
            analyzerRef.current.smoothingTimeConstant = 0.4; // Respuesta rápida para visemas
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

    // Analizar frecuencias para lip sync con detección de VISEMAS (Enhanced Quality)
    const analyzeFrequencies = useCallback((frequencyData, sampleRate = 24000) => {
        if (!frequencyData || frequencyData.length === 0) return null;

        const binCount = frequencyData.length;
        const nyquist = sampleRate / 2;
        const binWidth = nyquist / binCount;

        // ========== UTILIDADES ESPECTRALES ==========

        // Helper para obtener energía promedio en rango Hz
        const getEnergy = (low, high) => {
            const lowBin = Math.floor(low / binWidth);
            const highBin = Math.min(Math.ceil(high / binWidth), binCount - 1);
            if (lowBin >= highBin) return 0;

            let sum = 0;
            for (let i = lowBin; i <= highBin; i++) {
                sum += frequencyData[i];
            }
            return (sum / (highBin - lowBin + 1)) / 255;
        };

        // Detectar pico de energía en rango (formante)
        const getPeakFrequency = (low, high) => {
            const lowBin = Math.floor(low / binWidth);
            const highBin = Math.min(Math.ceil(high / binWidth), binCount - 1);
            if (lowBin >= highBin) return 0;

            let maxVal = 0;
            let maxBin = lowBin;
            for (let i = lowBin; i <= highBin; i++) {
                if (frequencyData[i] > maxVal) {
                    maxVal = frequencyData[i];
                    maxBin = i;
                }
            }
            return maxBin * binWidth;
        };

        // Calcular centroide espectral (brillo del sonido)
        const getSpectralCentroid = () => {
            let weightedSum = 0;
            let totalEnergy = 0;
            for (let i = 0; i < binCount; i++) {
                const freq = i * binWidth;
                const magnitude = frequencyData[i];
                weightedSum += freq * magnitude;
                totalEnergy += magnitude;
            }
            return totalEnergy > 0 ? weightedSum / totalEnergy : 0;
        };

        // ========== ANÁLISIS ESPECTRAL AVANZADO ==========

        // 1. Formantes precisos (picos de energía en rangos vocálicos)
        const formants = {
            F1: getPeakFrequency(200, 1000),   // Primera formante (apertura)
            F2: getPeakFrequency(800, 3000),   // Segunda formante (posición lengua)
            F3: getPeakFrequency(2000, 4000)   // Tercera formante (redondeo labios)
        };

        // 2. Bandas de energía mejoradas
        const energyBands = {
            subBass: getEnergy(20, 80),        // Rumble/Poder
            bass: getEnergy(80, 250),          // Fundamental
            lowMid: getEnergy(250, 500),       // F1 bajo (vocales abiertas)
            mid: getEnergy(500, 1000),         // F1 alto (vocales cerradas)
            highMid: getEnergy(1000, 2500),    // F2 (articulación)
            presence: getEnergy(2500, 5000),   // F3 + Claridad
            brilliance: getEnergy(5000, 8000), // Sibilantes
            air: getEnergy(8000, 12000)        // Fricativas agudas
        };

        // 3. Centroide espectral (indica "brillo" - útil para consonantes vs vocales)
        const centroid = getSpectralCentroid();
        const isBright = centroid > 2000; // Consonantes tienden a ser más brillantes

        // 4. Nivel general de volumen (ponderado por importancia perceptual)
        const level = Math.min(1,
            (energyBands.lowMid * 1.5 +
                energyBands.mid * 1.8 +
                energyBands.highMid * 1.2 +
                energyBands.bass * 0.8) / 4.0
        );

        // ========== DETECCIÓN DE VISEMAS MEJORADA ==========

        const visemes = {
            sil: 0,    // Silencio
            PP: 0,     // Bilabial (M, B, P)
            FF: 0,     // Labiodental (F, V)
            TH: 0,     // Dental (TH)
            DD: 0,     // Alveolar (T, D, N)
            kk: 0,     // Velar (K, G)
            CH: 0,     // Postalveolar (Ch, J, Sh)
            SS: 0,     // Sibilante (S, Z)
            nn: 0,     // Nasal
            aa: 0,     // Ah (Low Back) - /ɑ/
            EE: 0,     // Ee (High Front) - /i/
            ih: 0,     // Ih (High Front Lax) - /ɪ/
            oh: 0,     // Oh (Mid Back) - /o/
            ou: 0      // Oo (High Back) - /u/
        };

        // Umbral de silencio adaptativo
        if (level < 0.05) {
            visemes.sil = 1.0;
        } else {
            // ========== VOCALES ESPAÑOLAS (basadas en formantes F1/F2) ==========

            // Vocal "A" /a/ - F1 alto (700-900Hz), F2 medio-alto (1100-1400Hz)
            // Español: vocal central abierta, más frontal que inglés /ɑ/
            if (formants.F1 > 650 && formants.F1 < 950 &&
                formants.F2 > 1000 && formants.F2 < 1500) {
                const confidence = energyBands.lowMid * energyBands.mid;
                visemes.aa = Math.min(1, confidence * 2.8); // Boost para claridad
            }

            // Vocal "E" /e/ - F1 medio-bajo (400-550Hz), F2 alto (1800-2200Hz)
            // Español: más cerrada que inglés /ɛ/, sin distinción tensa/laxa
            if (formants.F1 > 350 && formants.F1 < 600 &&
                formants.F2 > 1700 && formants.F2 < 2300) {
                const confidence = energyBands.mid * energyBands.highMid;
                visemes.EE = Math.min(1, confidence * 3.2);
                visemes.aa *= 0.15; // Suprimir A
            }

            // Vocal "I" /i/ - F1 muy bajo (250-350Hz), F2 muy alto (2100-2600Hz)
            // Español: similar a inglés /i/, pero sin variante laxa /ɪ/
            if (formants.F1 < 400 && formants.F2 > 2000) {
                const confidence = energyBands.highMid * (1 - energyBands.lowMid);
                // Fusionar ih y EE para español (no hay distinción /i/ vs /ɪ/)
                const iWeight = Math.min(1, confidence * 3.5);
                visemes.EE = Math.max(visemes.EE, iWeight);
                visemes.ih = iWeight * 0.3; // Mínimo ih
                visemes.aa *= 0.1;
            }

            // Vocal "O" /o/ - F1 medio (400-550Hz), F2 bajo (800-1100Hz)
            // Español: más cerrada que inglés /ɔ/, labios redondeados
            if (formants.F1 > 380 && formants.F1 < 600 &&
                formants.F2 > 700 && formants.F2 < 1200 &&
                energyBands.bass > 0.18) {
                const confidence = energyBands.mid * energyBands.bass;
                visemes.oh = Math.min(1, confidence * 3.0);
                visemes.aa *= 0.25;
            }

            // Vocal "U" /u/ - F1 muy bajo (250-350Hz), F2 muy bajo (600-900Hz)
            // Español: labios muy redondeados, similar a inglés /u/
            if (formants.F1 < 380 && formants.F2 < 1000 &&
                energyBands.bass > 0.22) {
                const confidence = energyBands.bass * (1 - energyBands.highMid);
                visemes.ou = Math.min(1, confidence * 3.5);
                visemes.oh *= 0.35;
                visemes.aa *= 0.05;
            }

            // ========== CONSONANTES ESPAÑOLAS (basadas en energía espectral) ==========

            // Sibilantes /s/, /z/ - Energía concentrada 4-8kHz
            // Español: /s/ es más aguda y clara que en inglés
            if (energyBands.brilliance > 0.2 && isBright) {
                const sibilanceRatio = energyBands.brilliance / (energyBands.mid + 0.01);
                if (sibilanceRatio > 1.5) {
                    visemes.SS = Math.min(1, energyBands.brilliance * 5.0); // Boost para español
                    // Suprimir vocales durante sibilantes
                    visemes.aa *= 0.3;
                    visemes.oh *= 0.3;
                    visemes.EE *= 0.5;
                }
            }

            // Postalveolares /ʃ/, /ʒ/, /tʃ/, /dʒ/ - Energía 2-6kHz
            if (energyBands.presence > 0.3 && energyBands.brilliance > 0.15) {
                const chRatio = energyBands.presence / (energyBands.lowMid + 0.01);
                if (chRatio > 2.0) {
                    visemes.CH = Math.min(1, energyBands.presence * 3.5);
                    visemes.SS *= 0.6; // Diferenciar de S pura
                    visemes.aa *= 0.4;
                }
            }

            // Fricativas labiodentales /f/, /v/ - Ruido difuso 1.5-4kHz
            if (energyBands.highMid > 0.25 && energyBands.presence > 0.2 &&
                energyBands.brilliance < 0.2) {
                const fricativeRatio = energyBands.highMid / (energyBands.bass + 0.01);
                if (fricativeRatio > 1.8) {
                    visemes.FF = Math.min(1, energyBands.highMid * 3.0);
                    visemes.aa *= 0.5;
                }
            }

            // Dentales /θ/, /ð/ - Ruido suave 2-5kHz
            // ESPAÑOL: Muy raro (solo en préstamos o ceceo), reducir peso
            if (energyBands.presence > 0.25 && energyBands.brilliance < 0.15 &&
                energyBands.highMid > 0.25) {
                const dentalRatio = energyBands.presence / (energyBands.mid + 0.01);
                if (dentalRatio > 2.0 && dentalRatio < 3.5) {
                    visemes.TH = Math.min(0.6, energyBands.presence * 1.8); // Peso reducido
                    visemes.FF *= 0.6;
                }
            }

            // Alveolares /t/, /d/, /n/, /l/ - Transitorios rápidos, F2 alto
            if (formants.F2 > 1500 && energyBands.highMid > 0.35 &&
                energyBands.lowMid < 0.3) {
                const alveolarScore = energyBands.highMid * (1 - energyBands.lowMid);
                visemes.DD = Math.min(1, alveolarScore * 2.0);
                visemes.nn = visemes.DD * 0.6; // Nasal similar
            }

            // Velares /k/, /g/, /x/ (jota) - F2 bajo, transitorios
            if (formants.F2 < 1500 && energyBands.mid > 0.3 &&
                energyBands.bass > 0.25) {
                const velarScore = energyBands.mid * energyBands.bass;
                visemes.kk = Math.min(1, velarScore * 1.8);
            }

            // Bilabiales /p/, /b/, /m/ - Cierre completo (difícil detectar)
            // Aproximamos con caída súbita de energía o transición
            if (level < 0.15 && energyBands.bass > 0.1) {
                visemes.PP = Math.min(0.6, energyBands.bass * 1.5);
            }

            // ========== CONSONANTES ESPECÍFICAS DEL ESPAÑOL ==========

            // R vibrante simple /ɾ/ y RR vibrante múltiple /r/
            // Detección: F2 alto (~1600Hz) + modulación de amplitud rápida
            // La vibrante produce "pulsos" de energía en 20-30Hz
            if (formants.F2 > 1400 && formants.F2 < 1800 &&
                energyBands.highMid > 0.3 && energyBands.mid > 0.25) {
                // Aproximación: alta energía en medios con F2 característico
                const rScore = energyBands.highMid * energyBands.mid;
                // Usar visema 'nn' como proxy para R (o crear uno nuevo si existe)
                // En español, R es alveolar como N/D/T
                visemes.DD = Math.max(visemes.DD, rScore * 1.5);
                visemes.nn = Math.max(visemes.nn, rScore * 1.2);
            }
        }

        // ========== POST-PROCESAMIENTO PARA ESPAÑOL ==========

        // 1. Normalizar valores
        Object.keys(visemes).forEach(k => {
            visemes[k] = Math.min(1, Math.max(0, visemes[k]));
        });

        // 2. Winner-Takes-Most MEJORADO para español
        // El español tiene fonemas más claros y distintos que el inglés
        let maxVal = 0;
        let maxKey = 'sil';
        Object.entries(visemes).forEach(([k, v]) => {
            if (v > maxVal) {
                maxVal = v;
                maxKey = k;
            }
        });

        // Boost más agresivo al ganador (español requiere articulación clara)
        if (maxKey !== 'sil' && maxVal > 0.25) {
            visemes[maxKey] = Math.min(1, visemes[maxKey] * 1.5); // Boost aumentado

            // Suprimir competidores débiles más agresivamente
            Object.keys(visemes).forEach(k => {
                if (k !== maxKey && k !== 'sil' && visemes[k] < maxVal * 0.35) {
                    visemes[k] *= 0.4; // Supresión más fuerte
                }
            });
        }

        // 3. Retornar datos completos
        return {
            visemes,
            level,
            formants,        // Datos de formantes para debug
            centroid,        // Centroide espectral
            isBright,        // Flag de brillo
            // Compatibilidad legacy
            mouthOpen: Math.max(visemes.aa, visemes.oh, visemes.ou) || 0,
            mouthWide: Math.max(visemes.EE, visemes.ih) || 0
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

