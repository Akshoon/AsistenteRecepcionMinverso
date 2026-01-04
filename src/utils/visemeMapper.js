/**
 * Viseme Mapper - Mapea fonemas a blend shapes faciales
 * 
 * Basado en el estándar de visemas de Oculus/Meta y Adobe
 * Referencia: https://developer.oculus.com/documentation/native/audio-ovrlipsync-viseme-reference/
 */

// Definición de visemas estándar y sus blend shapes asociados
export const VISEME_DEFINITIONS = {
    // Silencio / Neutral
    sil: {
        name: 'Silence',
        blendShapes: {
            'Jaw_Open': 0.12,  // Mandíbula ligeramente abierta (natural)
            'Mouth_Close': 0,
            'Ah': 0,
            'Oh': 0,
            'W_OO': 0,
        }
    },

    // PP - Labios cerrados (P, B, M)
    PP: {
        name: 'PP (P, B, M)',
        phonemes: ['p', 'b', 'm'],
        blendShapes: {
            'Mouth_Close': 0.8,
            'Mouth_Press_L': 0.6,
            'Mouth_Press_R': 0.6,
            'Jaw_Open': 0.05,
        }
    },

    // FF - Labio inferior a dientes superiores (F, V)
    FF: {
        name: 'FF (F, V)',
        phonemes: ['f', 'v'],
        blendShapes: {
            'F_V': 0.7,
            'Mouth_Lower_Down_L': 0.5,
            'Mouth_Lower_Down_R': 0.5,
            'Jaw_Open': 0.15,
        }
    },

    // TH - Lengua entre dientes (TH as in "the")
    TH: {
        name: 'TH',
        phonemes: ['th', 'ð', 'θ'],
        blendShapes: {
            'TH': 0.6,
            'Tongue_Out': 0.3,
            'Jaw_Open': 0.2,
            'Mouth_Drop_Lower': 0.3,
        }
    },

    // DD - Lengua a paladar (D, T, N, L)
    DD: {
        name: 'DD (D, T, N, L)',
        phonemes: ['d', 't', 'n', 'l'],
        blendShapes: {
            'T_L_D_N': 0.7,
            'Jaw_Open': 0.2,
            'Mouth_Drop_Lower': 0.25,
        }
    },

    // kk - Garganta (K, G, NG, H)
    kk: {
        name: 'kk (K, G, NG, H)',
        phonemes: ['k', 'g', 'ŋ', 'h'],
        blendShapes: {
            'K_G_H_NG': 0.7,
            'Jaw_Open': 0.25,
            'Mouth_Drop_Lower': 0.2,
        }
    },

    // CH - Africadas (CH, J)
    CH: {
        name: 'CH (CH, J)',
        phonemes: ['tʃ', 'dʒ', 'ʃ', 'ʒ'],
        blendShapes: {
            'Ch_J': 0.7,
            'Mouth_Funnel_Up_L': 0.3,
            'Mouth_Funnel_Up_R': 0.3,
            'Jaw_Open': 0.2,
        }
    },

    // SS - Sibilantes (S, Z)
    SS: {
        name: 'SS (S, Z)',
        phonemes: ['s', 'z'],
        blendShapes: {
            'S_Z': 0.7,
            'Mouth_Stretch_L': 0.4,
            'Mouth_Stretch_R': 0.4,
            'Jaw_Open': 0.15,
        }
    },

    // nn - Nasal (N, NG)
    nn: {
        name: 'nn (N, NG)',
        phonemes: ['n', 'ŋ'],
        blendShapes: {
            'T_L_D_N': 0.6,
            'Nose_Nostril_Raise_L': 0.3,
            'Nose_Nostril_Raise_R': 0.3,
            'Jaw_Open': 0.15,
        }
    },

    // RR - R
    RR: {
        name: 'RR (R)',
        phonemes: ['r', 'ɹ'],
        blendShapes: {
            'R': 0.7,
            'Mouth_Funnel_Up_L': 0.2,
            'Mouth_Funnel_Up_R': 0.2,
            'Jaw_Open': 0.2,
        }
    },

    // aa - Vocal abierta (A as in "father")
    aa: {
        name: 'aa (A)',
        phonemes: ['ɑ', 'a'],
        blendShapes: {
            'Ah': 0.8,
            'Jaw_Open': 0.6,
            'Mouth_Drop_Lower': 0.5,
        }
    },

    // E - Vocal media (E as in "bed")
    E: {
        name: 'E',
        phonemes: ['ɛ', 'e'],
        blendShapes: {
            'AE': 0.7,
            'Jaw_Open': 0.35,
            'Mouth_Stretch_L': 0.4,
            'Mouth_Stretch_R': 0.4,
            'Mouth_Smile_L': 0.2,
            'Mouth_Smile_R': 0.2,
        }
    },

    // I - Vocal cerrada (I as in "sit")
    I: {
        name: 'I',
        phonemes: ['ɪ', 'i'],
        blendShapes: {
            'IH': 0.7,
            'Jaw_Open': 0.25,
            'Mouth_Smile_L': 0.5,
            'Mouth_Smile_R': 0.5,
            'Mouth_Stretch_L': 0.5,
            'Mouth_Stretch_R': 0.5,
        }
    },

    // O - Vocal redondeada (O as in "boat")
    O: {
        name: 'O',
        phonemes: ['o', 'ɔ'],
        blendShapes: {
            'Oh': 0.8,
            'Jaw_Open': 0.4,
            'Mouth_Funnel_Up_L': 0.4,
            'Mouth_Funnel_Up_R': 0.4,
        }
    },

    // U - Vocal muy redondeada (U as in "boot")
    U: {
        name: 'U',
        phonemes: ['u', 'ʊ'],
        blendShapes: {
            'W_OO': 0.9,
            'Jaw_Open': 0.3,
            'Mouth_Pucker_Up_L': 0.6,
            'Mouth_Pucker_Up_R': 0.6,
            'Mouth_Funnel_Up_L': 0.5,
            'Mouth_Funnel_Up_R': 0.5,
        }
    },
};

/**
 * Detecta el visema más probable basado en análisis de frecuencias
 * @param {Object} frequencyAnalysis - Análisis de frecuencias del audio
 * @returns {string} - Clave del visema detectado
 */
export function detectVisemeFromFrequencies(frequencyAnalysis) {
    const { f1Energy, f2Energy, highEnergy, lowEnergy } = frequencyAnalysis;

    // Reglas heurísticas basadas en formantes
    // Estas son aproximaciones y pueden mejorarse con ML

    // Silencio
    if (lowEnergy < 0.1 && f1Energy < 0.1) {
        return 'sil';
    }

    // Consonantes oclusivas labiales (PP) - baja energía en frecuencias altas
    if (lowEnergy > 0.3 && highEnergy < 0.2 && f1Energy < 0.3) {
        return 'PP';
    }

    // Fricativas labiodentales (FF) - energía alta en frecuencias medias-altas
    if (highEnergy > 0.5 && f2Energy > 0.4) {
        return 'FF';
    }

    // Sibilantes (SS) - energía muy alta en frecuencias altas
    if (highEnergy > 0.7) {
        return 'SS';
    }

    // Vocal abierta (aa) - F1 alto, F2 bajo
    if (f1Energy > 0.6 && f2Energy < 0.4 && lowEnergy > 0.4) {
        return 'aa';
    }

    // Vocal cerrada frontal (I) - F1 bajo, F2 alto
    if (f1Energy < 0.4 && f2Energy > 0.6) {
        return 'I';
    }

    // Vocal redondeada (O/U) - F1 medio, F2 bajo
    if (f1Energy > 0.4 && f1Energy < 0.7 && f2Energy < 0.3 && lowEnergy > 0.3) {
        return f1Energy > 0.55 ? 'O' : 'U';
    }

    // Vocal media (E) - F1 y F2 medios
    if (f1Energy > 0.3 && f1Energy < 0.6 && f2Energy > 0.4 && f2Energy < 0.7) {
        return 'E';
    }

    // Consonantes dentales (DD)
    if (f2Energy > 0.5 && highEnergy > 0.3 && highEnergy < 0.6) {
        return 'DD';
    }

    // Consonantes velares (kk)
    if (f1Energy > 0.3 && f2Energy < 0.4 && highEnergy > 0.2 && highEnergy < 0.5) {
        return 'kk';
    }

    // Por defecto, vocal media
    return 'E';
}

/**
 * Obtiene los blend shapes para un visema específico
 * @param {string} visemeKey - Clave del visema
 * @returns {Object} - Objeto con los blend shapes y sus valores
 */
export function getBlendShapesForViseme(visemeKey) {
    const viseme = VISEME_DEFINITIONS[visemeKey];
    if (!viseme) {
        return VISEME_DEFINITIONS.sil.blendShapes;
    }
    return viseme.blendShapes;
}

/**
 * Interpola suavemente entre dos conjuntos de blend shapes
 * @param {Object} currentShapes - Blend shapes actuales
 * @param {Object} targetShapes - Blend shapes objetivo
 * @param {number} factor - Factor de interpolación (0-1)
 * @returns {Object} - Blend shapes interpolados
 */
export function interpolateBlendShapes(currentShapes, targetShapes, factor) {
    const result = { ...currentShapes };

    for (const key in targetShapes) {
        const current = currentShapes[key] || 0;
        const target = targetShapes[key] || 0;
        result[key] = current + (target - current) * factor;
    }

    return result;
}

/**
 * Convierte análisis de frecuencias a blend shapes usando visemas
 * @param {Object} frequencyAnalysis - Análisis de frecuencias
 * @returns {Object} - Blend shapes calculados
 */
export function frequencyToBlendShapes(frequencyAnalysis) {
    // Detectar visema
    const viseme = detectVisemeFromFrequencies(frequencyAnalysis);

    // Obtener blend shapes base
    const baseShapes = getBlendShapesForViseme(viseme);

    // Ajustar intensidades basándose en la energía del audio
    const { lowEnergy, f1Energy, f2Energy, highEnergy } = frequencyAnalysis;
    const intensity = Math.max(lowEnergy, f1Energy, f2Energy, highEnergy);

    // Escalar blend shapes por intensidad
    const scaledShapes = {};
    for (const key in baseShapes) {
        scaledShapes[key] = baseShapes[key] * Math.min(1, intensity * 1.2);
    }

    return {
        viseme,
        blendShapes: scaledShapes,
        intensity
    };
}
