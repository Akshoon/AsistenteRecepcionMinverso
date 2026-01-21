/**
 * LipSyncProcessor.js - AudioWorklet for Real-Time Spanish Lip-Sync
 * 
 * Extracts RMS (energy) and ZCR (fricative detection) from audio stream.
 * Runs in dedicated audio thread with 128-sample buffer (~5.3ms at 24kHz).
 * 
 * @author Antigravity
 */

class LipSyncProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this._lastMessageTime = 0;
        this._messageInterval = 1000 / 60; // ~16ms, 60 updates/sec max
    }

    /**
     * Process audio samples and extract features
     * @param {Float32Array[][]} inputs - Input audio channels
     * @param {Float32Array[][]} outputs - Output audio channels (passthrough)
     * @returns {boolean} - Keep processor alive
     */
    process(inputs, outputs) {
        const input = inputs[0];
        const output = outputs[0];

        // Passthrough audio to speakers
        if (input.length > 0 && output.length > 0) {
            for (let channel = 0; channel < input.length; channel++) {
                if (input[channel] && output[channel]) {
                    output[channel].set(input[channel]);
                }
            }
        }

        // Get first channel for analysis
        const samples = input[0];
        if (!samples || samples.length === 0) {
            return true;
        }

        // Throttle messages to avoid overwhelming main thread
        if (currentTime - this._lastMessageTime < this._messageInterval / 1000) {
            return true;
        }
        this._lastMessageTime = currentTime;

        // === RMS Calculation (Energy/Volume) ===
        let sumSquares = 0;
        for (let i = 0; i < samples.length; i++) {
            sumSquares += samples[i] * samples[i];
        }
        const rms = Math.sqrt(sumSquares / samples.length);

        // === ZCR (Zero Crossing Rate) - Fricative Detection ===
        let zeroCrossings = 0;
        for (let i = 1; i < samples.length; i++) {
            if ((samples[i] >= 0) !== (samples[i - 1] >= 0)) {
                zeroCrossings++;
            }
        }
        const zcr = zeroCrossings / samples.length;

        // Send features to main thread
        this.port.postMessage({
            rms,
            zcr,
            timestamp: currentTime,
            sampleCount: samples.length
        });

        return true;
    }
}

registerProcessor('lip-sync-processor', LipSyncProcessor);
