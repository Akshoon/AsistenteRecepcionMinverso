/**
 * SpanishVisemeResolver.js - Real-Time Spanish Viseme Resolution
 * 
 * Resolves audio features (RMS, ZCR) to Spanish visemes with hysteresis
 * and coarticulation for natural, flicker-free animation.
 * 
 * @author Antigravity
 */

// Morph target mappings for Spanish neutral phonemes
export const SPANISH_VISEMES = {
    REST: [],
    A: ['Ah', 'AE'],           // Vocal abierta central
    E: ['EE', 'IH'],           // Vocal cerrada frontal
    O: ['Oh', 'W_OO'],         // Vocal cerrada posterior
    R: ['R', 'Er'],            // Vibrante
    S: ['S_Z'],                // Sibilante
    FV: ['F_V'],               // Labiodental
    MBP: ['B_M_P'],            // Bilabial
    TD: ['T_L_D_N'],           // Alveolar
    KG: ['K_G_H_NG'],          // Velar
};

// Thresholds from specification (DO NOT MODIFY - these are tuned for Spanish)
const THRESHOLDS = {
    SILENCE_RMS: 0.008,
    FRICATIVE_ZCR: 0.24,
    VOWEL_A_RMS: 0.06,
    VOWEL_O_RMS: 0.045,
    VOWEL_E_RMS: 0.03,
};

// Timing constants
const HYSTERESIS_MS = 45;    // Minimum time between viseme changes
const LERP_FACTOR = 0.35;    // Exponential smoothing factor
const COARTIC_DECAY = 0.4;   // Previous viseme weight

/**
 * Spanish Viseme Resolver Class
 * Maintains state for hysteresis and coarticulation
 */
export class SpanishVisemeResolver {
    constructor() {
        this._currentViseme = 'REST';
        this._previousViseme = 'REST';
        this._lastChangeTime = 0;
        this._visemeWeights = {};
        this._smoothedJaw = 0;

        // Initialize all viseme weights to 0
        Object.keys(SPANISH_VISEMES).forEach(v => {
            this._visemeWeights[v] = 0;
        });
    }

    /**
     * Resolve viseme from audio features
     * @param {number} rms - Root Mean Square (energy)
     * @param {number} zcr - Zero Crossing Rate
     * @param {number} timestamp - Current time in seconds
     * @returns {Object} viseme state with weights and jaw
     */
    resolve(rms, zcr, timestamp) {
        const now = timestamp * 1000; // Convert to ms

        // Determine raw viseme from thresholds (ORDER MATTERS!)
        let targetViseme = 'A'; // Default fallback

        if (rms < THRESHOLDS.SILENCE_RMS) {
            targetViseme = 'REST';
        } else if (zcr > THRESHOLDS.FRICATIVE_ZCR) {
            targetViseme = 'S';
        } else if (rms > THRESHOLDS.VOWEL_A_RMS) {
            targetViseme = 'A';
        } else if (rms > THRESHOLDS.VOWEL_O_RMS) {
            targetViseme = 'O';
        } else if (rms > THRESHOLDS.VOWEL_E_RMS) {
            targetViseme = 'E';
        }

        // === HYSTERESIS: Block rapid changes ===
        const timeSinceChange = now - this._lastChangeTime;
        if (targetViseme !== this._currentViseme && timeSinceChange >= HYSTERESIS_MS) {
            this._previousViseme = this._currentViseme;
            this._currentViseme = targetViseme;
            this._lastChangeTime = now;
        }

        // === COARTICULATION: Blend weights ===
        // Decay all weights
        Object.keys(this._visemeWeights).forEach(v => {
            this._visemeWeights[v] *= (1 - LERP_FACTOR);
        });

        // Apply current viseme weight
        if (this._currentViseme !== 'REST') {
            const targetWeight = 1.0;
            this._visemeWeights[this._currentViseme] +=
                (targetWeight - this._visemeWeights[this._currentViseme]) * LERP_FACTOR;
        }

        // Apply previous viseme weight (coarticulation)
        if (this._previousViseme !== 'REST' && this._previousViseme !== this._currentViseme) {
            const prevWeight = COARTIC_DECAY;
            this._visemeWeights[this._previousViseme] =
                Math.max(this._visemeWeights[this._previousViseme], prevWeight * (1 - LERP_FACTOR));
        }

        // === JAW CALCULATION ===
        // jaw = clamp(rms * 18, 0, 0.25) - Capped at 0.25 for natural look
        const targetJaw = Math.min(0.25, Math.max(0, rms * 18));
        this._smoothedJaw += (targetJaw - this._smoothedJaw) * LERP_FACTOR;

        // Clamp all weights to [0, 1]
        Object.keys(this._visemeWeights).forEach(v => {
            this._visemeWeights[v] = Math.min(1, Math.max(0, this._visemeWeights[v]));
        });

        return {
            viseme: this._currentViseme,
            previousViseme: this._previousViseme,
            weights: { ...this._visemeWeights },
            jaw: this._smoothedJaw,
            isActive: this._currentViseme !== 'REST'
        };
    }

    /**
     * Reset resolver state
     */
    reset() {
        this._currentViseme = 'REST';
        this._previousViseme = 'REST';
        this._lastChangeTime = 0;
        this._smoothedJaw = 0;
        Object.keys(this._visemeWeights).forEach(v => {
            this._visemeWeights[v] = 0;
        });
    }
}

/**
 * Get morph targets for a viseme
 * @param {string} viseme - Viseme key
 * @returns {string[]} - Array of morph target names
 */
export function getMorphTargets(viseme) {
    return SPANISH_VISEMES[viseme] || [];
}

export default SpanishVisemeResolver;
