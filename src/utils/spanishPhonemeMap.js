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
    '/a/': { F1: [650, 950], F2: [1200, 1500], viseme: 'AH' },
    '/e/': { F1: [450, 650], F2: [1900, 2300], viseme: 'EH' },
    '/i/': { F1: [300, 400], F2: [2300, 2800], viseme: 'IY' },
    '/o/': { F1: [450, 650], F2: [900, 1200], viseme: 'OH' },
    '/u/': { F1: [300, 400], F2: [700, 1000], viseme: 'UW' }
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
        viseme: 'Ah',
        morphs: {
            'Ah': 0.8,
            'Jaw_Open': 0.3,
            'Mouth_Smile_L': 0.1,
            'Mouth_Smile_R': 0.1
        },
        description: 'Open central vowel - wide mouth'
    },

    '/e/': {
        viseme: 'EE',
        morphs: {
            'EE': 0.5,
            'AE': 0.4,
            'Jaw_Open': 0.2,
            'Mouth_Smile_L': 0.2,
            'Mouth_Smile_R': 0.2
        },
        description: 'Mid front vowel - using EE + AE blend'
    },

    '/i/': {
        viseme: 'EE',
        morphs: {
            'EE': 0.8,
            'IH': 0.2,
            'Jaw_Open': 0.1,
            'Mouth_Smile_L': 0.3,
            'Mouth_Smile_R': 0.3
        },
        description: 'High front vowel - tense smile'
    },

    '/o/': {
        viseme: 'Oh',
        morphs: {
            'Oh': 0.85,
            'Jaw_Open': 0.3
        },
        description: 'Mid back vowel - rounded lips'
    },

    '/u/': {
        viseme: 'W_OO',
        morphs: {
            'W_OO': 0.9,
            'Jaw_Open': 0.15
        },
        description: 'High back vowel - tight rounded lips'
    },

    // === BILABIAL CONSONANTS ===
    '/p/': { viseme: 'B_M_P', morphs: { 'B_M_P': 0.8, 'Jaw_Open': 0.05 }, description: 'Voiceless bilabial plosive' },
    '/b/': { viseme: 'B_M_P', morphs: { 'B_M_P': 0.7, 'Jaw_Open': 0.1 }, description: 'Voiced bilabial plosive' },
    '/m/': { viseme: 'B_M_P', morphs: { 'B_M_P': 0.6, 'Jaw_Open': 0.1 }, description: 'Bilabial nasal' },

    // === LABIODENTAL CONSONANTS ===
    '/f/': { viseme: 'F_V', morphs: { 'F_V': 0.85, 'Jaw_Open': 0.1 }, description: 'Voiceless labiodental fricative' },
    '/v/': { viseme: 'F_V', morphs: { 'F_V': 0.7, 'Jaw_Open': 0.12 }, description: 'Voiced labiodental fricative' },

    // === ALVEOLAR CONSONANTS ===
    '/s/': { viseme: 'S_Z', morphs: { 'S_Z': 0.7, 'Jaw_Open': 0.1, 'EE': 0.2 }, description: 'Voiceless alveolar fricative' },
    '/z/': { viseme: 'S_Z', morphs: { 'S_Z': 0.6, 'Jaw_Open': 0.12, 'EE': 0.15 }, description: 'Voiced alveolar fricative' },
    '/t/': { viseme: 'T_L_D_N', morphs: { 'T_L_D_N': 0.6, 'Jaw_Open': 0.15 }, description: 'Voiceless alveolar plosive' },
    '/d/': { viseme: 'T_L_D_N', morphs: { 'T_L_D_N': 0.5, 'Jaw_Open': 0.15 }, description: 'Voiced alveolar plosive' },
    '/n/': { viseme: 'T_L_D_N', morphs: { 'T_L_D_N': 0.5, 'Jaw_Open': 0.15 }, description: 'Alveolar nasal' },
    '/l/': { viseme: 'T_L_D_N', morphs: { 'T_L_D_N': 0.5, 'Jaw_Open': 0.2 }, description: 'Alveolar lateral' },

    // === TAPS AND TRILLS ===
    '/r/': { viseme: 'R', morphs: { 'R': 0.6, 'T_L_D_N': 0.2, 'Jaw_Open': 0.2 }, description: 'Alveolar tap' },
    '/rr/': { viseme: 'R', morphs: { 'R': 0.8, 'T_L_D_N': 0.3, 'Jaw_Open': 0.2 }, description: 'Alveolar trill' },

    // === PALATAL CONSONANTS ===
    '/tʃ/': { viseme: 'Ch_J', morphs: { 'Ch_J': 0.8, 'Jaw_Open': 0.2 }, description: 'Voiceless postalveolar affricate (ch)' },
    '/ʝ/': { viseme: 'Ch_J', morphs: { 'Ch_J': 0.6, 'Jaw_Open': 0.2, 'EE': 0.2 }, description: 'Voiced palatal fricative (y)' },
    '/ɲ/': { viseme: 'T_L_D_N', morphs: { 'T_L_D_N': 0.5, 'Jaw_Open': 0.2, 'EE': 0.2 }, description: 'Palatal nasal (ñ)' },

    // === VELAR CONSONANTS ===
    '/k/': { viseme: 'K_G_H_NG', morphs: { 'K_G_H_NG': 0.7, 'Jaw_Open': 0.25 }, description: 'Voiceless velar plosive' },
    '/g/': { viseme: 'K_G_H_NG', morphs: { 'K_G_H_NG': 0.6, 'Jaw_Open': 0.25 }, description: 'Voiced velar plosive' },
    '/x/': { viseme: 'K_G_H_NG', morphs: { 'K_G_H_NG': 0.5, 'Jaw_Open': 0.3 }, description: 'Voiceless velar fricative (j)' },

    // === SEMIVOWELS ===
    '/w/': { viseme: 'W_OO', morphs: { 'W_OO': 0.6, 'Jaw_Open': 0.15 }, description: 'Labio-velar approximant' },
    '/j/': { viseme: 'EE', morphs: { 'EE': 0.6, 'Jaw_Open': 0.15 }, description: 'Palatal approximant' },

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
