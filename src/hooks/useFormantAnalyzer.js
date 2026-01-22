import { useEffect, useRef } from 'react';
import { detectVowelFromFormants, getMorphsForPhoneme } from '../utils/spanishPhonemeMap';

/**
 * useFormantAnalyzer - Real-time Formant Analysis for Spanish Phoneme Detection
 * 
 * Analyzes audio stream to detect vowel phonemes based on formant frequencies (F1, F2).
 * Uses spectral peak detection to identify resonant frequencies characteristic of vowels.
 * 
 * For consonants, uses energy distribution and zero-crossing rate heuristics.
 * 
 * @param {MediaStream} audioStream - Input audio stream from Gemini Live
 * @param {Object} options - Configuration options
 * @returns {Object} Current detected phoneme, viseme, and morph targets
 */
export default function useFormantAnalyzer(audioStream, options = {}) {
    const config = {
        fftSize: 1024, // Optimized from 2048 for better CPU performance
        smoothingTimeConstant: 0.3, // Reduced from 0.6 for faster detection
        minEnergyThreshold: 0.03, // Minimum RMS to trigger detection
        formantSearchRange: {
            F1: { min: 200, max: 1100 },  // Slightly higher max for female voice
            F2: { min: 800, max: 3200 }   // Higher max for female resonant frequencies
        },
        ...options
    };

    const audioContextRef = useRef(null);
    const analyserRef = useRef(null);
    const sourceRef = useRef(null);
    const dataArrayRef = useRef(null);
    const timeDataRef = useRef(null);

    const detectionState = useRef({
        currentPhoneme: 'SIL',
        currentViseme: 'SIL',
        currentMorphs: {},
        confidence: 0,
        lastDetectionTime: 0,
        history: [] // Keep last N detections for smoothing
    });

    // Initialize audio analysis
    useEffect(() => {
        if (!audioStream || !audioStream.active) {
            detectionState.current = {
                currentPhoneme: 'SIL',
                currentViseme: 'SIL',
                currentMorphs: {},
                confidence: 0,
                lastDetectionTime: 0,
                history: []
            };
            return;
        }

        const AudioContext = window.AudioContext || window.webkitAudioContext;
        const ctx = new AudioContext();
        const analyser = ctx.createAnalyser();
        analyser.fftSize = config.fftSize;
        analyser.smoothingTimeConstant = config.smoothingTimeConstant;

        const source = ctx.createMediaStreamSource(audioStream);
        source.connect(analyser);

        audioContextRef.current = ctx;
        analyserRef.current = analyser;
        sourceRef.current = source;
        dataArrayRef.current = new Uint8Array(analyser.frequencyBinCount);
        timeDataRef.current = new Uint8Array(analyser.fftSize);

        const handleInactive = () => {
            detectionState.current.currentPhoneme = 'SIL';
            detectionState.current.currentViseme = 'SIL';
            detectionState.current.currentMorphs = {};
        };

        audioStream.addEventListener('inactive', handleInactive);

        return () => {
            audioStream.removeEventListener('inactive', handleInactive);
            source.disconnect();
            analyser.disconnect();
            if (ctx.state !== 'closed') ctx.close();
        };
    }, [audioStream]);

    /**
     * Find spectral peaks (formants) in frequency data
     * @param {Uint8Array} freqData - FFT frequency data
     * @param {number} sampleRate - Audio context sample rate
     * @param {number} minHz - Minimum frequency to search
     * @param {number} maxHz - Maximum frequency to search
     * @returns {number} Peak frequency in Hz
     */
    const findPeak = (freqData, sampleRate, minHz, maxHz) => {
        const binSize = sampleRate / config.fftSize;
        const startBin = Math.floor(minHz / binSize);
        const endBin = Math.floor(maxHz / binSize);

        let maxValue = -1;
        let maxBin = startBin;

        const limit = Math.min(endBin, freqData.length);
        for (let i = startBin; i < limit; i++) {
            const val = freqData[i];
            if (val > maxValue) {
                maxValue = val;
                maxBin = i;
            }
        }

        return maxBin * binSize;
    };

    /**
     * Calculate RMS energy from time domain data
     * @param {Uint8Array} timeData - Waveform data
     * @returns {number} RMS value (0-1)
     */
    const calculateRMS = (timeData) => {
        let sum = 0;
        const len = timeData.length;
        for (let i = 0; i < len; i++) {
            const normalized = (timeData[i] - 128) * 0.0078125; // 1/128
            sum += normalized * normalized;
        }
        return Math.sqrt(sum / len);
    };

    /**
     * Calculate zero-crossing rate (proxy for consonant detection)
     * @param {Uint8Array} timeData - Waveform data
     * @returns {number} ZCR value
     */
    const calculateZCR = (timeData) => {
        let crossings = 0;
        const len = timeData.length;
        for (let i = 1; i < len; i++) {
            if ((timeData[i] ^ timeData[i - 1]) & 0x80) { // Check if MSB sign bit changed (128 is 10000000)
                // This is a bitwise trick for Uint8 centered at 128
                if ((timeData[i] >= 128 && timeData[i - 1] < 128) ||
                    (timeData[i] < 128 && timeData[i - 1] >= 128)) {
                    crossings++;
                }
            }
        }
        return crossings / len;
    };

    /**
     * Detect consonant type from spectral characteristics
     * @param {Uint8Array} freqData - FFT frequency data
     * @param {number} sampleRate - Audio context sample rate
     * @param {number} zcr - Zero-crossing rate
     * @param {number} rms - RMS energy
     * @returns {string} Detected consonant phoneme or null
     */
    const detectConsonant = (freqData, sampleRate, zcr, rms) => {
        const binSize = sampleRate / analyserRef.current.fftSize;

        // Calculate energy in different bands
        const getBandEnergy = (minHz, maxHz) => {
            const start = Math.floor(minHz / binSize);
            const end = Math.floor(maxHz / binSize);
            let sum = 0;
            for (let i = start; i < end && i < freqData.length; i++) sum += freqData[i];
            return sum / (end - start);
        };

        const lowBand = getBandEnergy(100, 500) / 255;    // Bilabials
        const midBand = getBandEnergy(500, 2000) / 255;   // Alveolars  
        const highBand = getBandEnergy(2000, 8000) / 255; // Fricatives

        // Total energy for ratio calculations
        const total = lowBand + midBand + highBand;
        if (total < 0.1) return null; // Not enough energy

        // CRITICAL: Only detect consonants with VERY distinctive patterns
        // Most speech is vowels - consonants should be the exception

        // High ZCR + dominant high frequency = fricatives (s, f, ch)
        if (zcr > 0.18 && highBand > 0.4 && highBand / total > 0.5) {
            if (highBand > 0.6) return '/s/';
            if (midBand > 0.3) return '/tʃ/';
            return '/f/';
        }

        // Very low RMS + sudden burst = plosives (p, t, k)
        // These are brief, don't match for sustained sounds
        if (rms < 0.08 && lowBand < 0.15) {
            return null; // Likely silence or very quiet vowel
        }

        // Only detect bilabials if LOW band is DOMINANT and brief
        if (lowBand > midBand * 1.5 && lowBand > highBand * 2.0 && lowBand > 0.35) {
            return '/b/';
        }

        // Only detect alveolars if MID band is DOMINANT
        if (midBand > lowBand * 1.5 && midBand > highBand && midBand > 0.4 && zcr > 0.12) {
            if (zcr > 0.15) return '/t/';
            return '/n/';
        }

        // Trill detection - very specific pattern
        if (midBand > 0.4 && zcr > 0.10 && zcr < 0.13 && lowBand < midBand) {
            return '/r/';
        }

        // Default: return null to let vowel detection run
        return null;
    };

    /**
     * Perform phoneme detection analysis
     * Call this in animation loop (useFrame)
     */
    const analyze = () => {
        if (!analyserRef.current || !dataArrayRef.current || !timeDataRef.current) {
            return detectionState.current;
        }

        const analyser = analyserRef.current;
        const freqData = dataArrayRef.current;
        const timeData = timeDataRef.current;
        const ctx = audioContextRef.current;

        // Get frequency and time domain data
        analyser.getByteFrequencyData(freqData);
        analyser.getByteTimeDomainData(timeData);

        // Calculate audio features
        const rms = calculateRMS(timeData);
        const zcr = calculateZCR(timeData);

        // Check if audio is below threshold (silence)
        if (rms < config.minEnergyThreshold) {
            detectionState.current = {
                currentPhoneme: 'SIL',
                currentViseme: 'SIL',
                currentMorphs: {},
                confidence: 1.0,
                lastDetectionTime: Date.now(),
                history: detectionState.current.history
            };
            return detectionState.current;
        }

        // PRIORITIZE VOWELS - they make up ~60% of speech
        // Try formant detection FIRST
        const f1 = findPeak(
            freqData,
            ctx.sampleRate,
            config.formantSearchRange.F1.min,
            config.formantSearchRange.F1.max
        );

        const f2 = findPeak(
            freqData,
            ctx.sampleRate,
            config.formantSearchRange.F2.min,
            config.formantSearchRange.F2.max
        );

        // Detect vowel from formant frequencies
        const detectedVowel = detectVowelFromFormants(f1, f2);

        // Only try consonant detection if vowel confidence is LOW (weak formants)
        // or if there are very distinctive consonant patterns
        const consonant = detectConsonant(freqData, ctx.sampleRate, zcr, rms);

        if (consonant && (rms < 0.15 || zcr > 0.15)) {
            // Strong consonant indicators - use consonant
            const morphs = getMorphsForPhoneme(consonant);
            detectionState.current = {
                currentPhoneme: consonant,
                currentViseme: morphs.viseme || 'SIL',
                currentMorphs: morphs,
                confidence: 0.75,
                lastDetectionTime: Date.now(),
                history: [...detectionState.current.history.slice(-2), consonant] // Shorten history to last 3 items
            };
            return detectionState.current;
        }

        // Default to vowel (most common in speech)
        const morphs = getMorphsForPhoneme(detectedVowel);
        const confidence = Math.min(rms * 5, 1.0);

        detectionState.current = {
            currentPhoneme: detectedVowel,
            currentViseme: morphs.viseme || 'SIL',
            currentMorphs: morphs,
            confidence: confidence,
            f1: f1,
            f2: f2,
            rms: rms,
            zcr: zcr,
            lastDetectionTime: Date.now(),
            history: [...detectionState.current.history.slice(-2), detectedVowel] // Shorten history to last 3 items
        };

        return detectionState.current;
    };

    /**
     * Get smoothed phoneme (average of recent detections)
     * Reduces jitter in detection
     */
    const getSmoothedPhoneme = () => {
        const history = detectionState.current.history;
        if (history.length === 0) return 'SIL';

        // Simple mode (most frequent) from last N detections
        const counts = {};
        history.forEach(p => counts[p] = (counts[p] || 0) + 1);

        let maxCount = 0;
        let mostFrequent = history[history.length - 1]; // Default to most recent

        for (const [phoneme, count] of Object.entries(counts)) {
            if (count > maxCount) {
                maxCount = count;
                mostFrequent = phoneme;
            }
        }

        return mostFrequent;
    };

    return {
        analyze,
        getState: () => detectionState.current,
        getSmoothedPhoneme,
        isActive: () => audioStream && audioStream.active
    };
}
