/**
 * Spanish Phoneme to Morph Target Mapping
 * 
 * Maps IPA phonemes and visemes to avatar morph targets with calibrated intensities.
 * Designed for Spanish language lip-sync with natural-looking animations.
 * 
 * Based on linguistic analysis of Spanish phonetics and avatar morph target capabilities.
 */

/**
 * Formant ranges for Spanish vowels (in Hz)
 * Used for acoustic detection and classification
 */
export const SPANISH_VOWEL_FORMANTS = {
    '/a/': { F1: [600, 900], F2: [1100, 1400], viseme: 'AH' },
    '/e/': { F1: [400, 600], F2: [1800, 2200], viseme: 'EH' },
    '/i/': { F1: [250, 350], F2: [2200, 2600], viseme: 'IY' },
    '/o/': { F1: [400, 600], F2: [800, 1100], viseme: 'OH' },
    '/u/': { F1: [250, 350], F2: [600, 900], viseme: 'UW' }
};

/**
 * Consonant spectral characteristics
 * Frequency ranges and energy patterns for detection
 */
export const SPANISH_CONSONANT_FEATURES = {
    // Bilabials: Energy burst in low frequencies
    '/p/': { type: 'plosive', energy: 'low', duration: 'short', viseme: 'BMP' },
    '/b/': { type: 'plosive', energy: 'low', duration: 'short', viseme: 'BMP' },
    '/m/': { type: 'nasal', energy: 'low', duration: 'medium', viseme: 'BMP' },

    // Labiodentals: High frequency friction
    '/f/': { type: 'fricative', energy: 'high', duration: 'medium', viseme: 'FV' },
    '/v/': { type: 'fricative', energy: 'high', duration: 'medium', viseme: 'FV' },

    // Alveolars: Mid-high frequency
    '/s/': { type: 'fricative', energy: 'high', duration: 'medium', viseme: 'SZ' },
    '/z/': { type: 'fricative', energy: 'high', duration: 'medium', viseme: 'SZ' },
    '/t/': { type: 'plosive', energy: 'mid', duration: 'short', viseme: 'TLDN' },
    '/d/': { type: 'plosive', energy: 'mid', duration: 'short', viseme: 'TLDN' },
    '/n/': { type: 'nasal', energy: 'mid', duration: 'medium', viseme: 'TLDN' },
    '/l/': { type: 'lateral', energy: 'mid', duration: 'medium', viseme: 'TLDN' },
    '/r/': { type: 'tap', energy: 'mid', duration: 'short', viseme: 'R' },
    '/rr/': { type: 'trill', energy: 'mid', duration: 'medium', viseme: 'R' },

    // Palatals
    '/tʃ/': { type: 'affricate', energy: 'high', duration: 'medium', viseme: 'CH' },
    '/ʝ/': { type: 'fricative', energy: 'mid', duration: 'medium', viseme: 'CH' },
    '/ɲ/': { type: 'nasal', energy: 'mid', duration: 'medium', viseme: 'TLDN' },

    // Velars
    '/k/': { type: 'plosive', energy: 'mid', duration: 'short', viseme: 'KG' },
    '/g/': { type: 'plosive', energy: 'mid', duration: 'short', viseme: 'KG' },
    '/x/': { type: 'fricative', energy: 'mid', duration: 'medium', viseme: 'KG' }
};

/**
 * Complete phoneme to morph target mapping
 * Each entry specifies which morph targets to activate and their intensities
 */
export const PHONEME_TO_MORPH_MAP = {
    // === VOWELS ===
    '/a/': {
        viseme: 'AH',
        morphs: {
            'Ah': 0.55,        // Reduced from 0.75
            'Jaw_Open': 0.30,  // Reduced from 0.45
            'AE': 0.15         // Reduced from 0.25
        },
        description: 'Open central vowel - wide mouth'
    },

    '/e/': {
        viseme: 'EH',
        morphs: {
            'EE': 0.50,        // Reduced from 0.65
            'Jaw_Open': 0.12,  // Reduced from 0.20
            'IH': 0.18         // Reduced from 0.25
        },
        description: 'Mid front vowel - spread lips'
    },

    '/i/': {
        viseme: 'IY',
        morphs: {
            'EE': 0.65,        // Reduced from 0.85
            'Jaw_Open': 0.05,  // Reduced from 0.10
            'Mouth_Smile_L': 0.08,  // Reduced from 0.12
            'Mouth_Smile_R': 0.08   // Reduced from 0.12
        },
        description: 'High front vowel - tense smile'
    },

    '/o/': {
        viseme: 'OH',
        morphs: {
            'Oh': 0.55,        // Reduced from 0.75
            'W_OO': 0.28,      // Reduced from 0.40
            'Jaw_Open': 0.15   // Reduced from 0.25
        },
        description: 'Mid back vowel - rounded lips'
    },

    '/u/': {
        viseme: 'UW',
        morphs: {
            'W_OO': 0.65,      // Reduced from 0.85
            'Oh': 0.20,        // Reduced from 0.30
            'Jaw_Open': 0.08   // Reduced from 0.15
        },
        description: 'High back vowel - tight rounded lips'
    },

    // === BILABIAL CONSONANTS ===
    '/p/': { viseme: 'BMP', morphs: { 'B_M_P': 0.60, 'Jaw_Open': 0.0 }, description: 'Voiceless bilabial plosive' },
    '/b/': { viseme: 'BMP', morphs: { 'B_M_P': 0.55, 'Jaw_Open': 0.03 }, description: 'Voiced bilabial plosive' },
    '/m/': { viseme: 'BMP', morphs: { 'B_M_P': 0.50, 'Jaw_Open': 0.05 }, description: 'Bilabial nasal' },

    // === LABIODENTAL CONSONANTS ===
    '/f/': { viseme: 'FV', morphs: { 'F_V': 0.60, 'Jaw_Open': 0.08 }, description: 'Voiceless labiodental fricative' },
    '/v/': { viseme: 'FV', morphs: { 'F_V': 0.55, 'Jaw_Open': 0.10 }, description: 'Voiced labiodental fricative' },

    // === ALVEOLAR CONSONANTS ===
    '/s/': { viseme: 'SZ', morphs: { 'S_Z': 0.55, 'Jaw_Open': 0.08, 'EE': 0.15 }, description: 'Voiceless alveolar fricative' },
    '/z/': { viseme: 'SZ', morphs: { 'S_Z': 0.50, 'Jaw_Open': 0.10, 'EE': 0.12 }, description: 'Voiced alveolar fricative' },
    '/t/': { viseme: 'TLDN', morphs: { 'T_L_D_N': 0.55, 'Jaw_Open': 0.12 }, description: 'Voiceless alveolar plosive' },
    '/d/': { viseme: 'TLDN', morphs: { 'T_L_D_N': 0.50, 'Jaw_Open': 0.15 }, description: 'Voiced alveolar plosive' },
    '/n/': { viseme: 'TLDN', morphs: { 'T_L_D_N': 0.45, 'Jaw_Open': 0.18 }, description: 'Alveolar nasal' },
    '/l/': { viseme: 'TLDN', morphs: { 'T_L_D_N': 0.42, 'Jaw_Open': 0.15 }, description: 'Alveolar lateral' },

    // === TAPS AND TRILLS ===
    '/r/': { viseme: 'R', morphs: { 'R': 0.58, 'T_L_D_N': 0.25, 'Jaw_Open': 0.15 }, description: 'Alveolar tap' },
    '/rr/': { viseme: 'R', morphs: { 'R': 0.65, 'T_L_D_N': 0.30, 'Jaw_Open': 0.18 }, description: 'Alveolar trill' },

    // === PALATAL CONSONANTS ===
    '/tʃ/': { viseme: 'CH', morphs: { 'Ch_J': 0.58, 'Jaw_Open': 0.15, 'W_OO': 0.15 }, description: 'Voiceless postalveolar affricate (ch)' },
    '/ʝ/': { viseme: 'CH', morphs: { 'Ch_J': 0.50, 'Jaw_Open': 0.18, 'EE': 0.12 }, description: 'Voiced palatal fricative (y)' },
    '/ɲ/': { viseme: 'TLDN', morphs: { 'T_L_D_N': 0.45, 'Jaw_Open': 0.18, 'EE': 0.12 }, description: 'Palatal nasal (ñ)' },

    // === VELAR CONSONANTS ===
    '/k/': { viseme: 'KG', morphs: { 'K_G_H_NG': 0.50, 'Jaw_Open': 0.15 }, description: 'Voiceless velar plosive' },
    '/g/': { viseme: 'KG', morphs: { 'K_G_H_NG': 0.45, 'Jaw_Open': 0.18 }, description: 'Voiced velar plosive' },
    '/x/': { viseme: 'KG', morphs: { 'K_G_H_NG': 0.42, 'Jaw_Open': 0.20 }, description: 'Voiceless velar fricative (j)' },

    // === SEMIVOWELS ===
    '/w/': { viseme: 'UW', morphs: { 'W_OO': 0.60, 'Jaw_Open': 0.12 }, description: 'Labio-velar approximant' },
    '/j/': { viseme: 'IY', morphs: { 'EE': 0.58, 'Jaw_Open': 0.10 }, description: 'Palatal approximant' },

    // === SILENCE / REST ===
    'SIL': { viseme: 'SIL', morphs: {}, description: 'Silence - neutral position' }
};

/**
 * Viseme groups for simplified detection
 * Maps similar phonemes to the same visual representation
 */
export const VISEME_GROUPS = {
    'AH': ['/a/', '/aː/'],
    'EH': ['/e/', '/eː/'],
    'IY': ['/i/', '/iː/', '/j/'],
    'OH': ['/o/', '/oː/'],
    'UW': ['/u/', '/uː/', '/w/'],
    'BMP': ['/p/', '/b/', '/m/'],
    'FV': ['/f/', '/v/'],
    'SZ': ['/s/', '/z/', '/θ/'],
    'TLDN': ['/t/', '/d/', '/n/', '/l/', '/ɲ/'],
    'R': ['/r/', '/rr/', '/ɾ/'],
    'CH': ['/tʃ/', '/ʝ/', '/ʃ/'],
    'KG': ['/k/', '/g/', '/x/', '/ŋ/'],
    'SIL': ['SIL', 'pau', 'sp']
};

/**
 * Get morph targets for a given phoneme
 * @param {string} phoneme - IPA phoneme string
 * @returns {Object} Morph target names and intensities
 */
export function getMorphsForPhoneme(phoneme) {
    const mapping = PHONEME_TO_MORPH_MAP[phoneme];
    if (!mapping) {
        console.warn(`Unknown phoneme: ${phoneme}, returning neutral`);
        return {};
    }
    return mapping.morphs;
}

/**
 * Get viseme name for a phoneme
 * @param {string} phoneme - IPA phoneme string
 * @returns {string} Viseme identifier
 */
export function getVisemeForPhoneme(phoneme) {
    const mapping = PHONEME_TO_MORPH_MAP[phoneme];
    return mapping ? mapping.viseme : 'SIL';
}

/**
 * Detect vowel phoneme from formant frequencies
 * @param {number} f1 - First formant frequency (Hz)
 * @param {number} f2 - Second formant frequency (Hz)
 * @returns {string} Detected phoneme
 */
export function detectVowelFromFormants(f1, f2) {
    let bestMatch = '/a/';
    let minDistance = Infinity;

    for (const [phoneme, formants] of Object.entries(SPANISH_VOWEL_FORMANTS)) {
        const f1Center = (formants.F1[0] + formants.F1[1]) / 2;
        const f2Center = (formants.F2[0] + formants.F2[1]) / 2;

        // Euclidean distance in formant space
        const distance = Math.sqrt(
            Math.pow(f1 - f1Center, 2) +
            Math.pow(f2 - f2Center, 2)
        );

        if (distance < minDistance) {
            minDistance = distance;
            bestMatch = phoneme;
        }
    }

    return bestMatch;
}

/**
 * Blend between two phoneme morph sets for smooth transitions (co-articulation)
 * @param {string} phoneme1 - Current phoneme
 * @param {string} phoneme2 - Next phoneme
 * @param {number} blend - Blend factor (0 = phoneme1, 1 = phoneme2)
 * @returns {Object} Blended morph targets
 */
export function blendPhonemes(phoneme1, phoneme2, blend = 0.5) {
    const morphs1 = getMorphsForPhoneme(phoneme1);
    const morphs2 = getMorphsForPhoneme(phoneme2);

    const blended = {};
    const allKeys = new Set([...Object.keys(morphs1), ...Object.keys(morphs2)]);

    for (const key of allKeys) {
        const val1 = morphs1[key] || 0;
        const val2 = morphs2[key] || 0;
        blended[key] = val1 * (1 - blend) + val2 * blend;
    }

    return blended;
}

export default {
    SPANISH_VOWEL_FORMANTS,
    SPANISH_CONSONANT_FEATURES,
    PHONEME_TO_MORPH_MAP,
    VISEME_GROUPS,
    getMorphsForPhoneme,
    getVisemeForPhoneme,
    detectVowelFromFormants,
    blendPhonemes
};
