/**
 * Base abstract class for TTS Services.
 * Defines the contract that all TTS implementations must follow.
 */
export class BaseTTS {
    constructor(config) {
        this.config = config;
    }

    /**
     * Check if the service is fully configured.
     * @returns {boolean}
     */
    isConfigured() {
        throw new Error("Method 'isConfigured' must be implemented.");
    }

    /**
     * Convert text to speech.
     * @param {string} text - The text to convert.
     * @returns {Promise<Buffer>} - The audio buffer.
     */
    async textToSpeech(text) {
        throw new Error("Method 'textToSpeech' must be implemented.");
    }
}
