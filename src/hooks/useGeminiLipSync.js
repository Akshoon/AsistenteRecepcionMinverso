import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import useFormantAnalyzer from './useFormantAnalyzer';
import { blendPhonemes } from '../utils/spanishPhonemeMap';

/**
 * useGeminiLipSync (ENHANCED VERSION with Viseme Detection)
 * 
 * Implementación Final de Ingeniería Gráfica 3D & Audio DSP.
 * 
 * CARACTERÍSTICAS CRÍTICAS:
 * 1. FIX MANDÍBULA: Solo Morph Target 'Jaw_Open'. Bone.rotation PROHIBIDO.
 * 2. FIX ECO: Grafo de Audio Pasivo (Source -> Analyser). Sin salida a speakers.
 * 3. MICRO-COMPORTAMIENTOS: Respiración, Parpadeo Inteligente, Emociones Suaves.
 * 4. NUEVA: Detección de Visemas basada en Formantes para fonemas españoles precisos.
 * 
 * @param {Object} props
 * @param {THREE.Group} props.scene - Avatar Scene Group
 * @param {MediaStream} props.audioStream - Input Stream (Gemini PCM -> MediaStream)
 * @param {string} props.currentEmotion - 'neutral', 'happy', 'sad', 'angry', 'surprised'
 * @param {boolean} props.useAdvancedVisemes - Enable formant-based viseme detection (default: true)
 */
export default function useGeminiLipSync({ scene, audioStream, currentEmotion = 'neutral', useAdvancedVisemes = true }) {

    // === CONFIGURACIÓN ===
    const CONFIG = {
        SMOOTH_FACTOR: 0.5, // RMS_SmoothingFactor
        JAW_MAX: 0.25,
        EMOTION_MAX: 0.15,
        BREATH_INTERVAL: 3000,
        USE_ADVANCED_VISEMES: useAdvancedVisemes,
        VISEME_BLEND_FACTOR: 0.3,
        JAW_SMOOTH_FACTOR: 0.1,    // jawSmoothFactor
        EMOTION_SMOOTH_FACTOR: 0.1, // emotionSmoothFactor
        COARTICULACION_SMOOTH_FACTOR: 0.15 // coarticulacion_smooth_factor
    };

    // === ADVANCED VISEME ANALYZER ===
    const formantAnalyzer = useFormantAnalyzer(audioStream, {
        fftSize: 2048,
        minEnergyThreshold: 0.03,
        smoothingTimeConstant: CONFIG.SMOOTH_FACTOR
    });

    // Debug logging
    useEffect(() => {
        console.log('[useGeminiLipSync] Hook mounted/updated');
        console.log('[useGeminiLipSync] audioStream:', audioStream ? 'EXISTS' : 'NULL', 'active:', audioStream?.active);
        console.log('[useGeminiLipSync] Advanced visemes:', CONFIG.USE_ADVANCED_VISEMES);
    }, [audioStream]);

    // === NOMBRES DE MORPHS ===
    const MORPHS = {
        JAW: 'Jaw_Open',
        AH: 'Ah',
        OH: 'Oh',
        WOO: 'W_OO',
        EE: 'EE',
        IH: 'IH',
        SZ: 'S_Z',
        FV: 'F_V',
        TLDN: 'T_L_D_N',
        SMILE_L: 'Mouth_Smile_L', SMILE_R: 'Mouth_Smile_R',
        FROWN_L: 'Mouth_Frown_L', FROWN_R: 'Mouth_Frown_R',
        BLINK_L: 'Eye_Blink_L', BLINK_R: 'Eye_Blink_R',
        // ... otros se usan dinámicamente según mapa de emociones
    };

    // === REFERENCIAS DE ESTADO (MUTABLE, NO RENDER) ===
    const state = useRef({
        currentValues: {
            Jaw_Open: 0,
            Ah: 0, Oh: 0, W_OO: 0, EE: 0, IH: 0,
            S_Z: 0, F_V: 0, T_L_D_N: 0
        },
        currentEmotions: {},
        breathTimer: 0,
        isBreathing: false,
        blink: { value: 0, timer: 0, closing: false, duration: 0.12, nextBlinkTime: 3000 }
    });

    const audioRefs = useRef({
        ctx: null,
        analyser: null,
        dataArray: null,
        source: null
    });

    const meshRefs = useRef({
        morphMeshes: []
    });

    // === UTILIDAD: CLEANUP / RESET ===
    const resetFace = () => {
        meshRefs.current.morphMeshes.forEach(mesh => {
            if (!mesh.morphTargetInfluences) return;
            mesh.morphTargetInfluences.fill(0);
        });
        state.current.currentValues = { Jaw_Open: 0, Ah: 0, Oh: 0, W_OO: 0, EE: 0, IH: 0, S_Z: 0, F_V: 0, T_L_D_N: 0 };
        state.current.currentEmotions = {};
    };

    // === 1. INICIALIZACIÓN: CACHE DE MESHES ===
    useEffect(() => {
        if (!scene) return;
        const meshes = [];
        scene.traverse((obj) => {
            if (obj.isMesh && obj.morphTargetDictionary && obj.morphTargetInfluences) {
                meshes.push(obj);
            }
        });
        meshRefs.current.morphMeshes = meshes;

        // Reset inicial por si acaso
        resetFace();

        return () => resetFace();
    }, [scene]);

    // === 2. SETUP DE AUDIO (GRAFO PASIVO) ===
    useEffect(() => {
        if (!audioStream || !audioStream.active) {
            resetFace();
            return;
        }

        const AudioContext = window.AudioContext || window.webkitAudioContext;
        const ctx = new AudioContext(); // Nuevo contexto independiente para análisis
        audioRefs.current.ctx = ctx;

        const analyser = ctx.createAnalyser();
        analyser.fftSize = 1024;
        analyser.smoothingTimeConstant = CONFIG.SMOOTH_FACTOR;

        const source = ctx.createMediaStreamSource(audioStream);

        // CONEXIÓN PASIVA: Source -> Analyser
        // 🚨 NUNCA CONECTAR A DESTINATION (Fix Eco)
        source.connect(analyser);

        audioRefs.current.analyser = analyser;
        audioRefs.current.source = source;
        audioRefs.current.dataArray = new Uint8Array(analyser.frequencyBinCount);

        const handleInactive = () => {
            console.log('[useGeminiLipSync] audioStream inactive - Resetting face');
            resetFace();
        };
        audioStream.addEventListener('inactive', handleInactive);

        return () => {
            audioStream.removeEventListener('inactive', handleInactive);
            source.disconnect();
            analyser.disconnect();
            if (ctx.state !== 'closed') ctx.close();
            resetFace();
            audioRefs.current.analyser = null;
        };
    }, [audioStream]);

    // === 3. BUCLE DE ANIMACIÓN (USEFRAME) ===
    useFrame((_, delta) => {
        // Safe check for delta
        if (!delta || isNaN(delta)) delta = 0.016; // Fallback to ~60fps
        // Clamp delta to prevent "explosion" on tab switch (max 100ms)
        delta = Math.min(delta, 0.1);

        const { analyser, dataArray, ctx } = audioRefs.current;
        const meshes = meshRefs.current.morphMeshes;

        if (!analyser || !dataArray || meshes.length === 0) return;
        if (audioStream && !audioStream.active) { resetFace(); return; }

        // --- A. ANÁLISIS DSP ---
        analyser.getByteFrequencyData(dataArray);
        const binSize = ctx.sampleRate / analyser.fftSize;

        const getBandEnergy = (minHz, maxHz) => {
            const start = Math.floor(minHz / binSize);
            const end = Math.floor(maxHz / binSize);
            let sum = 0;
            if (end <= start) return 0;
            for (let i = start; i < end; i++) sum += dataArray[i];
            return (sum / (end - start)) / 255;
        };

        const low = getBandEnergy(100, 350);
        const mid = getBandEnergy(350, 2000);
        const high = getBandEnergy(2000, 5000);

        // Cálculo RMS desde TimeDomain (Más preciso para lipsync que FFT sum)
        // Pero usamos FFT sum por eficiencia ya que ya tenemos dataArray frequency
        let totalEnergy = 0;
        for (let i = 0; i < dataArray.length; i++) totalEnergy += dataArray[i];
        let rms = (totalEnergy / dataArray.length) / 255 * 4.5; // Reduced boost from 9.0 to 4.5

        // === NOISE GATE ===
        // If rms is very low, force it to 0 to prevent "hanging" mouth
        const NOISE_THRESHOLD = 0.1; // Increased from 0.02 to 0.1 to catch 0.06 noise
        if (rms < NOISE_THRESHOLD) rms = 0;

        // ZCR Proxy (Ratio High/Low)
        const zcr = high; // Simplificado para eficiencia en frame loop

        // --- B. DETECCIÓN DE VISEMAS (Advanced Mode o Fallback) ---
        let TARGETS = {};

        if (CONFIG.USE_ADVANCED_VISEMES && formantAnalyzer) {
            // === NUEVO: ANÁLISIS BASADO EN FORMANTES ===
            const visemeData = formantAnalyzer.analyze();

            // DEBUG: Log detection results (reduce logging)
            if (visemeData && visemeData.currentPhoneme && visemeData.currentPhoneme !== 'SIL' && Math.random() < 0.1) {
                console.log('[VISEME]', visemeData.currentPhoneme, 'conf:', visemeData.confidence?.toFixed(2));
            }

            if (visemeData && visemeData.currentMorphs) {
                // RMS SUPREMACY: Si el volumen es bajo, IGNORAR detección de fonemas (es ruido)
                if (rms === 0) { // NOISE_THRESHOLD forces rms to 0 above
                    // Force Silence
                    visemeData.currentMorphs = { Jaw_Open: 0 };
                    visemeData.currentPhoneme = 'SIL';
                }

                // Usar morphs detectados por el analizador de formantes
                const rawTargets = { ...visemeData.currentMorphs };

                // Ajustar Jaw_Open según energía RMS (driver maestro) con dampening adicional
                let targetJaw = Math.pow(rms, 0.7) * CONFIG.JAW_MAX * 0.85; // Reducido con factor 0.85

                // AGGRESSIVE JAW CLAMP: Si es menor al 10% de apertura, forzar a 0 absoluto
                if (targetJaw < 0.1 * CONFIG.JAW_MAX) { // e.g. < 0.025
                    targetJaw = 0;
                }

                // Si el fonema ya tiene Jaw_Open, lo combinamos con RMS pero limitamos
                if (rawTargets['Jaw_Open']) {
                    rawTargets['Jaw_Open'] = Math.min(
                        Math.max(rawTargets['Jaw_Open'], targetJaw * 0.75),
                        CONFIG.JAW_MAX * 0.9 // Límite absoluto
                    );
                } else {
                    rawTargets['Jaw_Open'] = targetJaw;
                }

                // === ADVANCED MULTI-FRAME SMOOTHING ===
                // Mantener historial de los últimos 3 frames para suavizado temporal
                if (!state.current.morphHistory) {
                    state.current.morphHistory = [];
                }

                // SILENCE CLEAR: If hard silence (gate closed) OR forced zero jaw
                if ((rms === 0 || targetJaw === 0) && state.current.morphHistory.length > 0) {
                    state.current.morphHistory = [];
                }

                // Agregar frame actual al historial
                state.current.morphHistory.push(rawTargets);
                if (state.current.morphHistory.length > 3) {
                    state.current.morphHistory.shift(); // Reduced history from 5 to 3 for less lag
                }

                // CO-ARTICULATION WEIGHTS: Favor current frame heavily for reactivity
                const weights = [0.10, 0.20, 0.70]; // Total = 1.0 (70% weight to newest frame)
                const blendedTargets = {};

                // Obtener todas las claves de morph únicas (managed morphs + current frame)
                const managedMorphs = ['Jaw_Open', 'Ah', 'Oh', 'W_OO', 'EE', 'IH', 'S_Z', 'F_V', 'T_L_D_N'];
                const allMorphKeys = new Set([...managedMorphs]);
                state.current.morphHistory.forEach(frame => {
                    Object.keys(frame).forEach(key => allMorphKeys.add(key));
                });

                // Promediar cada morph con pesos
                allMorphKeys.forEach(morphName => {
                    let weightedSum = 0;
                    let totalWeight = 0;

                    state.current.morphHistory.forEach((frame, idx) => {
                        const value = frame[morphName] || 0;
                        const weight = weights[idx] || 0.20;
                        weightedSum += value * weight;
                        totalWeight += weight;
                    });

                    // CO-ARTICULATION BLENDING
                    const prevValue = state.current.currentValues[morphName] || 0;
                    const computedTarget = totalWeight > 0 ? weightedSum / totalWeight : 0;

                    blendedTargets[morphName] = THREE.MathUtils.lerp(computedTarget, prevValue, CONFIG.COARTICULACION_SMOOTH_FACTOR);
                });

                // Aplicar suavizado adicional con lerp variable (Time-Based)
                TARGETS = {};
                // Velocidades de interpolación (Aumentadas para mayor reactividad)
                const SPEED_ATTACK = 22.0; // Increased from 10.0
                const SPEED_DECAY = 14.0;   // Increased from 4.0
                const SPEED_SILENCE = 24.0; // Faster silence snap

                allMorphKeys.forEach(morphName => {
                    const targetValue = blendedTargets[morphName] || 0;
                    const currentValue = state.current.currentValues[morphName] || 0;

                    // Detectar silencio: si el target es muy bajo, usar velocidad de silencio para cerrar
                    const isSilence = targetValue < 0.01;

                    // Elegir velocidad
                    let speed;
                    if (isSilence && currentValue > 0.01) {
                        speed = SPEED_SILENCE;
                    } else {
                        speed = targetValue > currentValue ? SPEED_ATTACK : SPEED_DECAY;
                    }

                    // Lerp independiente del framerate
                    const t = Math.min(1, speed * delta);
                    const finalLerp = morphName === 'Jaw_Open' ? CONFIG.JAW_SMOOTH_FACTOR : t;
                    TARGETS[morphName] = THREE.MathUtils.lerp(currentValue, targetValue, finalLerp);

                    // Force absolute zero check to avoid micro-values hanging
                    if (isSilence && TARGETS[morphName] < 0.002) {
                        TARGETS[morphName] = 0;
                    }

                    // Update state for next frame
                    state.current.currentValues[morphName] = TARGETS[morphName];
                });

                // DEBUG: Reduced logging
                if (TARGETS['Jaw_Open'] > 0.05 && Math.random() < 0.05) {
                    console.log('[TARGETS] Jaw:', TARGETS['Jaw_Open'].toFixed(2));
                }
            } else {
                // Fallback a silencio si no hay detección - smooth return to 0
                TARGETS = {};
                Object.keys(state.current.currentValues).forEach(key => {
                    const current = state.current.currentValues[key] || 0;
                    TARGETS[key] = THREE.MathUtils.lerp(current, 0, 0.06); // Muy lento fade to neutral
                    state.current.currentValues[key] = TARGETS[key];
                });
            }
        } else {
            // === FALLBACK: LÓGICA HEURÍSTICA ORIGINAL ===
            const epsilon = 0.0001;
            const total = low + mid + high + epsilon;

            // 1. Mandíbula (Driver Maestro) - FIX MESH DETACHMENT
            const targetJaw = Math.pow(rms, 0.6) * CONFIG.JAW_MAX;
            state.current.currentValues.Jaw_Open = targetJaw;

            // 2. Vocales (Multiplicadores ajustados a mitad de boost)
            const targetAh = (low / total) * rms * 1.0;
            const targetOh = (low / total) * rms * 0.6;
            const targetWoo = (low / total) * rms * 0.5;
            const targetEE = (mid / total) * rms * 0.9;
            const targetIH = (mid / total) * rms * 0.6;

            // 3. Consonantes (ZCR Driven) - Reduced sensititivy (2.5)
            const c = Math.max(0, Math.min(1, zcr * 2.5));
            const targetSZ = c * 0.25;
            const targetFV = c * 0.2;
            const targetTLDN = c * 0.2;

            // Build TARGETS for fallback mode
            const currentJaw = THREE.MathUtils.lerp(state.current.currentValues.Jaw_Open, targetJaw, 0.2);
            state.current.currentValues.Jaw_Open = currentJaw;

            TARGETS = {
                [MORPHS.JAW]: currentJaw,
                [MORPHS.AH]: THREE.MathUtils.lerp(state.current.currentValues.Ah, targetAh, 0.1),
                [MORPHS.OH]: THREE.MathUtils.lerp(state.current.currentValues.Oh, targetOh, 0.1),
                [MORPHS.WOO]: THREE.MathUtils.lerp(state.current.currentValues.W_OO, targetWoo, 0.1),
                [MORPHS.EE]: THREE.MathUtils.lerp(state.current.currentValues.EE, targetEE, 0.1),
                [MORPHS.IH]: THREE.MathUtils.lerp(state.current.currentValues.IH, targetIH, 0.1),
                [MORPHS.SZ]: THREE.MathUtils.lerp(state.current.currentValues.S_Z, targetSZ, 0.1),
                [MORPHS.FV]: THREE.MathUtils.lerp(state.current.currentValues.F_V, targetFV, 0.1),
                [MORPHS.TLDN]: THREE.MathUtils.lerp(state.current.currentValues.T_L_D_N, targetTLDN, 0.1)
            };
        }

        // --- C. MICRO-COMPORTAMIENTOS (Shared for both modes) ---

        // Respiración (Breathing)
        state.current.breathTimer += delta * 1000;
        let breathValue = 0;
        if (rms < 0.04 && high > mid && state.current.breathTimer > CONFIG.BREATH_INTERVAL) {
            // Trigger breath cycle
            state.current.isBreathing = true;
            // Reset timer logic handled differently usually, but simple cycle here:
            const cycle = (Math.sin(Date.now() / 500) + 1) / 2; // 0-1 oscill
            breathValue = cycle * 0.05;
        } else {
            state.current.isBreathing = false;
        }

        // Add breathing to Jaw if not already at max
        if (TARGETS[MORPHS.JAW] !== undefined) {
            TARGETS[MORPHS.JAW] = Math.min(TARGETS[MORPHS.JAW] + breathValue, CONFIG.JAW_MAX);
        }

        // Parpadeo Inteligente (Smart Blink)
        state.current.blink.timer += delta * 1000;
        if (state.current.blink.timer > state.current.blink.nextBlinkTime) {
            state.current.blink.closing = true;
            state.current.blink.timer = 0;
            // Next random time (3s to 5s)
            state.current.blink.nextBlinkTime = 3000 + Math.random() * 2000;

            // Context ajustment
            if (currentEmotion === 'surprised') state.current.blink.nextBlinkTime += 2000; // Stare
        }

        // Animación Blink
        const blkSpeed = (currentEmotion === 'sad') ? 8 : 15; // Lento si triste

        if (state.current.blink.closing) {
            state.current.blink.value += delta * blkSpeed;
            if (state.current.blink.value >= 1) {
                state.current.blink.value = 1;
                state.current.blink.closing = false;
            }
        } else {
            state.current.blink.value -= delta * blkSpeed;
            if (state.current.blink.value < 0) state.current.blink.value = 0;
        }
        const blinkVal = state.current.blink.value;

        // Add blink to TARGETS
        TARGETS[MORPHS.BLINK_L] = blinkVal;
        TARGETS[MORPHS.BLINK_R] = blinkVal;

        // Guardar estado
        state.current.currentValues = {
            Jaw_Open: TARGETS[MORPHS.JAW],
            Ah: TARGETS[MORPHS.AH], Oh: TARGETS[MORPHS.OH], W_OO: TARGETS[MORPHS.WOO],
            EE: TARGETS[MORPHS.EE], IH: TARGETS[MORPHS.IH],
            S_Z: TARGETS[MORPHS.SZ], F_V: TARGETS[MORPHS.FV], T_L_D_N: TARGETS[MORPHS.TLDN]
        };

        // Emociones (Aditivas)
        const EMOTION_MAP = {
            neutral: {},
            happy: { Mouth_Smile_L: 0.3, Mouth_Smile_R: 0.3, Cheek_Raise_L: 0.2, Cheek_Raise_R: 0.2 },
            sad: { Mouth_Frown_L: 0.3, Mouth_Frown_R: 0.3, Brow_Drop_L: 0.2, Brow_Drop_R: 0.2 },
            angry: { Brow_Compress_L: 0.4, Brow_Compress_R: 0.4, Mouth_Tighten_L: 0.2, Mouth_Tighten_R: 0.2 },
            surprised: { Eye_Wide_L: 0.3, Eye_Wide_R: 0.3, Brow_Raise_Inner_L: 0.3, Brow_Raise_Inner_R: 0.3 }
        };
        const activeEmotion = EMOTION_MAP[currentEmotion] || {};

        // Aplicar
        meshes.forEach(mesh => {
            if (!mesh.morphTargetDictionary || !mesh.morphTargetInfluences) return;

            // 1. Lipsync Base - Apply directly from TARGETS
            Object.entries(TARGETS).forEach(([morphName, value]) => {
                const idx = mesh.morphTargetDictionary[morphName];
                if (idx !== undefined && value !== undefined) {
                    mesh.morphTargetInfluences[idx] = Math.min(Math.max(value, 0), 1);
                }
            });

            // 2. Emociones (Suavizadas)
            Object.entries(activeEmotion).forEach(([k, v]) => {
                // Lerp emotion state
                const current = state.current.currentEmotions[k] || 0;
                const next = THREE.MathUtils.lerp(current, Math.min(v, CONFIG.EMOTION_MAX), CONFIG.EMOTION_SMOOTH_FACTOR);
                state.current.currentEmotions[k] = next;

                const idx = mesh.morphTargetDictionary[k];
                if (idx !== undefined) {
                    const existing = TARGETS[k] !== undefined ? mesh.morphTargetInfluences[idx] : 0;
                    mesh.morphTargetInfluences[idx] = Math.min(existing + next, 1);
                }
            });

            // Fade out unused emotions
            Object.keys(state.current.currentEmotions).forEach(k => {
                if (activeEmotion[k] === undefined) {
                    const current = state.current.currentEmotions[k];
                    const next = THREE.MathUtils.lerp(current, 0, delta * 2.0); // Slow fade out
                    state.current.currentEmotions[k] = next;

                    if (next > 0.001) {
                        const idx = mesh.morphTargetDictionary[k];
                        if (idx !== undefined) {
                            const existing = TARGETS[k] !== undefined ? mesh.morphTargetInfluences[idx] : 0;
                            mesh.morphTargetInfluences[idx] = Math.min(existing + next, 1);
                        }
                    }
                    else delete state.current.currentEmotions[k];
                }
            });
        });
    });
}
