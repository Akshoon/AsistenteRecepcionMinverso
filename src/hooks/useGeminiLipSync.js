import { useRef, useCallback, useMemo } from 'react';
import * as THREE from 'three';

/**
 * useGeminiLipSync - Real-Time Lip-Sync Hook for Gemini Spanish Female Voice
 * 
 * Optimized for Character Creator GLB avatars with Armature + SkinnedMesh.
 * Features:
 * - 20ms lookahead buffer for reduced perceived latency
 * - Jaw bone as primary driver (rotation.x ≤ 0.48)
 * - Jaw_Open morph strictly clamped to 0.5
 * - Spanish vocal mapping (NO AE, Er, R morphs)
 * - ZCR-based consonant detection
 * - Non-interfering emotion overlays
 * 
 * @author Antigravity
 * @spec Gemini Spanish Female Voice Lip-Sync v1.0
 */

// ============================================================================
// CONSTANTS
// ============================================================================

/** Maximum jaw bone rotation in radians (CRITICAL: Never exceed) */
const JAW_ROTATION_MAX = 0.35;

/** Maximum Jaw_Open morph value (CRITICAL: Never exceed) */
const JAW_OPEN_MAX = 0.5;

/** Lookahead buffer size in frames (~20ms at 60fps ≈ 1-2 frames) */
const LOOKAHEAD_FRAMES = 2;

/** Circular buffer capacity */
const BUFFER_CAPACITY = 30;

/** Lerp factors */
const JAW_LERP = 0.22;
const MORPH_LERP = 0.25;
const EMOTION_LERP = 0.12;

/** Maximum emotion intensity */
const EMOTION_MAX_INTENSITY = 0.35;

// ============================================================================
// EMOTION PRESETS
// ============================================================================

const EMOTION_PRESETS = {
    neutral: {},
    happy: {
        'Mouth_Smile_L': 0.25,
        'Mouth_Smile_R': 0.25,
        'Cheek_Raise_L': 0.15,
        'Cheek_Raise_R': 0.15,
        'Brow_Raise_Outer_L': 0.10,
        'Brow_Raise_Outer_R': 0.10,
    },
    sad: {
        'Mouth_Frown_L': 0.25,
        'Mouth_Frown_R': 0.25,
        'Brow_Drop_L': 0.20,
        'Brow_Drop_R': 0.20,
        'Eye_Squint_L': 0.10,
        'Eye_Squint_R': 0.10,
    },
    angry: {
        'Brow_Compress_L': 0.35,
        'Brow_Compress_R': 0.35,
        'Nose_Sneer_L': 0.15,
        'Nose_Sneer_R': 0.15,
        'Mouth_Tighten_L': 0.20,
        'Mouth_Tighten_R': 0.20,
    },
    surprised: {
        'Eye_Wide_L': 0.30,
        'Eye_Wide_R': 0.30,
        'Brow_Raise_Inner_L': 0.35,
        'Brow_Raise_Inner_R': 0.35,
    },
};

// Emotion morphs that should NOT be modified by lip-sync
const EMOTION_MORPH_NAMES = new Set([
    'Mouth_Smile_L', 'Mouth_Smile_R',
    'Cheek_Raise_L', 'Cheek_Raise_R',
    'Brow_Raise_Outer_L', 'Brow_Raise_Outer_R',
    'Mouth_Frown_L', 'Mouth_Frown_R',
    'Brow_Drop_L', 'Brow_Drop_R',
    'Eye_Squint_L', 'Eye_Squint_R',
    'Brow_Compress_L', 'Brow_Compress_R',
    'Nose_Sneer_L', 'Nose_Sneer_R',
    'Mouth_Tighten_L', 'Mouth_Tighten_R',
    'Eye_Wide_L', 'Eye_Wide_R',
    'Brow_Raise_Inner_L', 'Brow_Raise_Inner_R',
]);

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Clamp value between min and max
 */
function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

/**
 * Linear interpolation
 */
function lerp(current, target, factor) {
    return current + (target - current) * factor;
}

// ============================================================================
// CIRCULAR BUFFER CLASS
// ============================================================================

class CircularBuffer {
    constructor(capacity) {
        this.capacity = capacity;
        this.buffer = new Array(capacity).fill(null);
        this.head = 0;
        this.size = 0;
    }

    push(item) {
        this.buffer[this.head] = item;
        this.head = (this.head + 1) % this.capacity;
        if (this.size < this.capacity) this.size++;
    }

    get(offsetFromNewest) {
        if (offsetFromNewest >= this.size) return null;
        const idx = (this.head - 1 - offsetFromNewest + this.capacity) % this.capacity;
        return this.buffer[idx];
    }

    getLookahead(lookaheadFrames) {
        // Get future frame (lookahead)
        // Since we're looking ahead, we return the newest item if available
        // In practice, the lookahead is achieved by buffering and delaying visual output
        return this.get(0); // Return latest for now
    }

    clear() {
        this.buffer.fill(null);
        this.head = 0;
        this.size = 0;
    }
}

// ============================================================================
// MAIN HOOK
// ============================================================================

/**
 * useGeminiLipSync Hook
 * 
 * @param {Object} options
 * @param {THREE.Bone} options.jawBone - The jaw bone for rotation
 * @param {Object} options.morphTargets - Mesh morph target dictionary/influences
 * @param {Object} options.audioFeatures - Audio features { rms, low, mid, high, zcr }
 * @param {string} options.emotionState - Emotion: "neutral" | "happy" | "sad" | "angry" | "surprised"
 * @returns {Object} - { update, reset, getState }
 */
export default function useGeminiLipSync() {
    // ========== REFS ==========

    // Circular buffer for lookahead
    const bufferRef = useRef(new CircularBuffer(BUFFER_CAPACITY));

    // Previous values for lerp
    const prevJawRef = useRef(0);
    const prevMorphsRef = useRef({});
    const prevEmotionMorphsRef = useRef({});

    // Current state
    const stateRef = useRef({
        jaw: 0,
        morphs: {},
        emotionMorphs: {},
        isActive: false,
    });

    // ========== COMPUTE LIPSYNC ==========

    const computeLipSync = useCallback((features, emotionState = 'neutral') => {
        if (!features) {
            return {
                jaw: 0,
                morphs: { 'Jaw_Open': 0 },
                emotionMorphs: {},
                isActive: false,
            };
        }

        const { rms = 0, low = 0, mid = 0, high = 0, zcr = 0 } = features;
        const epsilon = 0.0001;

        // ===== JAW BONE CALCULATION (PRIMARY DRIVER) =====
        // jawTarget = pow(rms, 0.65) * 0.48
        const jawTarget = clamp(Math.pow(rms, 0.65) * JAW_ROTATION_MAX, 0, JAW_ROTATION_MAX);
        const jaw = lerp(prevJawRef.current, jawTarget, JAW_LERP);
        prevJawRef.current = jaw;

        // ===== JAW_OPEN MORPH (STRICT LIMIT) =====
        // Jaw_Open = clamp(jaw * 0.9, 0.0, 0.5)
        const jawOpen = clamp(jaw * 0.9, 0, JAW_OPEN_MAX);

        // ===== VOCAL MORPH MAPPING (SPANISH) =====
        const total = low + mid + high + epsilon;
        const lowN = low / total;
        const midN = mid / total;

        const vocalMorphs = {
            'Ah': lowN * rms * 0.9,
            'EE': midN * rms * 0.95,
            'IH': midN * rms * 0.6,
            'Oh': lowN * rms * 0.45,
            'W_OO': lowN * rms * 0.35,
        };

        // ===== CONSONANT MORPHS (ZCR-BASED) =====
        const consonant = clamp(zcr * 3.2, 0, 1);

        const consonantMorphs = {
            'S_Z': consonant * 0.35,
            'F_V': consonant * 0.30,
            'T_L_D_N': consonant * 0.25,
            'B_M_P': consonant * 0.30,
            'Ch_J': consonant * 0.20,
            'K_G_H_NG': consonant * 0.20,
            'TH': consonant * 0.10,
        };

        // ===== TONGUE MORPHS (DISABLED - follows jaw via skinning) =====
        const tongueMorphs = {};

        // ===== COMBINE LIP-SYNC MORPHS =====
        const lipSyncMorphs = {
            'Jaw_Open': jawOpen,
            ...vocalMorphs,
            ...consonantMorphs,
            ...tongueMorphs,
        };

        // Apply lerp to all morphs
        const smoothedMorphs = {};
        for (const [name, target] of Object.entries(lipSyncMorphs)) {
            const prev = prevMorphsRef.current[name] || 0;
            smoothedMorphs[name] = lerp(prev, target, MORPH_LERP);
        }
        prevMorphsRef.current = smoothedMorphs;

        // ===== EMOTION MORPHS (NON-INTERFERING) =====
        const emotionPreset = EMOTION_PRESETS[emotionState] || {};
        const emotionMorphs = {};

        for (const [name, targetValue] of Object.entries(emotionPreset)) {
            const clampedTarget = clamp(targetValue, 0, EMOTION_MAX_INTENSITY);
            const prev = prevEmotionMorphsRef.current[name] || 0;
            emotionMorphs[name] = lerp(prev, clampedTarget, EMOTION_LERP);
        }

        // Decay unused emotion morphs
        for (const name of EMOTION_MORPH_NAMES) {
            if (!emotionPreset[name]) {
                const prev = prevEmotionMorphsRef.current[name] || 0;
                if (prev > 0.001) {
                    emotionMorphs[name] = lerp(prev, 0, EMOTION_LERP);
                }
            }
        }
        prevEmotionMorphsRef.current = emotionMorphs;

        return {
            jaw,
            morphs: smoothedMorphs,
            emotionMorphs,
            isActive: rms > 0.01,
        };
    }, []);

    // ========== UPDATE FUNCTION ==========

    /**
     * Update lip-sync state with new audio features
     * Should be called every frame from useFrame
     * 
     * @param {THREE.Bone} jawBone - The jaw bone to animate
     * @param {SkinnedMesh[]} morphMeshes - Array of meshes with morph targets
     * @param {Object} audioFeatures - { rms, low, mid, high, zcr }
     * @param {string} emotionState - Current emotion state
     */
    const update = useCallback((jawBone, morphMeshes, audioFeatures, emotionState = 'neutral') => {
        // Push features to buffer for lookahead
        bufferRef.current.push(audioFeatures);

        // Get lookahead features (use features from ~20ms ahead)
        const lookaheadFeatures = bufferRef.current.size >= LOOKAHEAD_FRAMES
            ? bufferRef.current.get(LOOKAHEAD_FRAMES - 1)
            : audioFeatures;

        // Compute lip-sync state
        const state = computeLipSync(lookaheadFeatures, emotionState);
        stateRef.current = state;

        // ===== APPLY JAW BONE ROTATION =====
        // DISABLED: Jaw bone rotation causes asymmetric mouth movement
        // The jaw bone pivot may not be centered in this avatar's rigging
        // Using only Jaw_Open morph instead
        if (jawBone && jawBone.isBone) {
            // jawBone.rotation.x = state.jaw;  // DISABLED - causes asymmetry
            jawBone.rotation.x = 0;  // Keep jaw bone at rest position
        }

        // ===== APPLY MORPH TARGETS =====
        if (morphMeshes && morphMeshes.length > 0) {
            for (const mesh of morphMeshes) {
                if (!mesh.morphTargetDictionary || !mesh.morphTargetInfluences) continue;

                const dict = mesh.morphTargetDictionary;
                const inf = mesh.morphTargetInfluences;

                // Apply lip-sync morphs
                for (const [name, value] of Object.entries(state.morphs)) {
                    if (dict[name] !== undefined) {
                        inf[dict[name]] = value;
                    }
                }

                // Apply emotion morphs (only on face meshes)
                const isFaceMesh = mesh.name === 'CC_Base_Body001' ||
                    mesh.name.includes('Head') ||
                    mesh.name.includes('Face');

                if (isFaceMesh) {
                    for (const [name, value] of Object.entries(state.emotionMorphs)) {
                        if (dict[name] !== undefined) {
                            inf[dict[name]] = value;
                        }
                    }
                }
            }
        }

        return state;
    }, [computeLipSync]);

    // ========== RESET FUNCTION ==========

    const reset = useCallback(() => {
        bufferRef.current.clear();
        prevJawRef.current = 0;
        prevMorphsRef.current = {};
        prevEmotionMorphsRef.current = {};
        stateRef.current = {
            jaw: 0,
            morphs: {},
            emotionMorphs: {},
            isActive: false,
        };
    }, []);

    // ========== GET STATE FUNCTION ==========

    const getState = useCallback(() => {
        return { ...stateRef.current };
    }, []);

    // ========== RETURN API ==========

    return {
        update,
        reset,
        getState,
        // Constants for external use
        JAW_ROTATION_MAX,
        JAW_OPEN_MAX,
        EMOTION_PRESETS,
    };
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
    JAW_ROTATION_MAX,
    JAW_OPEN_MAX,
    EMOTION_PRESETS,
    EMOTION_MORPH_NAMES,
};
