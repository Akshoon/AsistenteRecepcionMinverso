import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * useGeminiLipSync (DEFINITIVE VERSION)
 * 
 * Implementación Final de Ingeniería Gráfica 3D & Audio DSP.
 * 
 * CARACTERÍSTICAS CRÍTICAS:
 * 1. FIX MANDÍBULA: Solo Morph Target 'Jaw_Open'. Bone.rotation PROHIBIDO.
 * 2. FIX ECO: Grafo de Audio Pasivo (Source -> Analyser). Sin salida a speakers.
 * 3. MICRO-COMPORTAMIENTOS: Respiración, Parpadeo Inteligente, Emociones Suaves.
 * 
 * @param {Object} props
 * @param {THREE.Group} props.scene - Avatar Scene Group
 * @param {MediaStream} props.audioStream - Input Stream (Gemini PCM -> MediaStream)
 * @param {string} props.currentEmotion - 'neutral', 'happy', 'sad', 'angry', 'surprised'
 */
export default function useGeminiLipSync({ scene, audioStream, currentEmotion = 'neutral' }) {

    // === CONFIGURACIÓN ===
    const CONFIG = {
        SMOOTH_FACTOR: 0.8, // DSP Smoothing
        JAW_MAX: 0.5,       // Max morph value
        EMOTION_MAX: 0.2,   // Uncanny Valley Limit (Reduced for neutral)
        BREATH_INTERVAL: 3000, // Min ms between breaths
    };

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

        const handleInactive = () => resetFace();
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
        const rms = (totalEnergy / dataArray.length) / 255 * 4.5; // Reduced boost from 9.0 to 4.5

        // ZCR Proxy (Ratio High/Low)
        const zcr = high; // Simplificado para eficiencia en frame loop

        // --- B. LÓGICA FONÉTICA (ESPAÑOL FEMENINO) ---
        const epsilon = 0.0001;
        const total = low + mid + high + epsilon;

        // 1. Mandíbula (Driver Maestro) - FIX MESH DETACHMENT
        // Mayor sensibilidad (pow 0.6) pero controlada
        const targetJaw = Math.pow(rms, 0.6) * CONFIG.JAW_MAX;
        // Suavizado Lerp
        const currentJaw = THREE.MathUtils.lerp(state.current.currentValues.Jaw_Open, targetJaw, 0.2);
        state.current.currentValues.Jaw_Open = currentJaw;

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

        // --- C. MICRO-COMPORTAMIENTOS ---

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
        let blinkTarget = 0;
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

        // --- D. APLICACIÓN A MESHES ---

        // Mapa de valores finales
        const TARGETS = {
            [MORPHS.JAW]: currentJaw + breathValue, // Add breathing
            [MORPHS.AH]: THREE.MathUtils.lerp(state.current.currentValues.Ah, targetAh, 0.1),
            [MORPHS.OH]: THREE.MathUtils.lerp(state.current.currentValues.Oh, targetOh, 0.1),
            [MORPHS.WOO]: THREE.MathUtils.lerp(state.current.currentValues.W_OO, targetWoo, 0.1),
            [MORPHS.EE]: THREE.MathUtils.lerp(state.current.currentValues.EE, targetEE, 0.1),
            [MORPHS.IH]: THREE.MathUtils.lerp(state.current.currentValues.IH, targetIH, 0.1),
            [MORPHS.SZ]: THREE.MathUtils.lerp(state.current.currentValues.S_Z, targetSZ, 0.1), // Smoother consonants
            [MORPHS.FV]: THREE.MathUtils.lerp(state.current.currentValues.F_V, targetFV, 0.1),
            [MORPHS.TLDN]: THREE.MathUtils.lerp(state.current.currentValues.T_L_D_N, targetTLDN, 0.1),
            [MORPHS.BLINK_L]: blinkVal,
            [MORPHS.BLINK_R]: blinkVal
        };

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

            const setVal = (key, val) => {
                const idx = mesh.morphTargetDictionary[key];
                if (idx !== undefined) mesh.morphTargetInfluences[idx] = Math.min(val, 1);
            };

            const addVal = (key, val) => {
                const idx = mesh.morphTargetDictionary[key];
                if (idx !== undefined) {
                    const curr = mesh.morphTargetInfluences[idx];
                    mesh.morphTargetInfluences[idx] = Math.min(curr + val, 1);
                }
            };

            // 1. Lipsync Base
            Object.entries(TARGETS).forEach(([k, v]) => setVal(k, v));

            // 2. Emociones (Suavizadas)
            Object.entries(activeEmotion).forEach(([k, v]) => {
                // Lerp emotion state
                const current = state.current.currentEmotions[k] || 0;
                const next = THREE.MathUtils.lerp(current, Math.min(v, CONFIG.EMOTION_MAX), 0.1);
                state.current.currentEmotions[k] = next;

                // FIX ACCUMULATION BUG:
                // Si el morph ya fue seteado por TARGETS (ej. Jaw_Open), sumamos (addVal).
                // Si es un morph puro de emoción (ej. Smile), lo sobrescribimos (setVal) para evitar acumulación infinita.
                if (TARGETS[k] !== undefined) {
                    addVal(k, next);
                } else {
                    setVal(k, next);
                }
            });

            // Fade out unused emotions
            Object.keys(state.current.currentEmotions).forEach(k => {
                if (activeEmotion[k] === undefined) {
                    const current = state.current.currentEmotions[k];
                    const next = THREE.MathUtils.lerp(current, 0, 0.1);
                    state.current.currentEmotions[k] = next;

                    if (next > 0.001) {
                        if (TARGETS[k] !== undefined) {
                            addVal(k, next);
                        } else {
                            setVal(k, next);
                        }
                    }
                    else delete state.current.currentEmotions[k];
                }
            });
        });
    });
}
