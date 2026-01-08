import { GeminiLLMService } from './GeminiLLMService.js';
import { GeminiAudioService } from './GeminiAudioService.js';

export class LLMFactory {
    /**
     * Factory method to create an LLM Service instance.
     * @param {string} type - The type of LLM (e.g., 'gemini', 'gpt').
     * @param {Object} config - Configuration object for the service.
     * @returns {BaseLLM}
     */
    static createLLM(type, config) {
        if (!type) {
            throw new Error("LLM type is required");
        }

        switch (type.toLowerCase()) {
            case 'gemini':
                return new GeminiLLMService(config);
            default:
                throw new Error(`Unknown LLM type: ${type}`);
        }
    }

    /**
     * Factory method to create a Gemini Audio Service instance.
     * Uses gemini-2.5-flash-native-audio-dialog for STT/TTS
     * @param {Object} config - Configuration object
     * @returns {GeminiAudioService}
     */
    static createAudioService(config) {
        return new GeminiAudioService(config);
    }
}
