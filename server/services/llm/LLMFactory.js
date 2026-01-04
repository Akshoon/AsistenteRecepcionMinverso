import { GeminiLLMService } from './GeminiLLMService.js';

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
            // Future extensions:
            // case 'gpt':
            //     return new GPTService(config);
            // case 'deepseek':
            //     return new DeepSeekService(config);
            default:
                throw new Error(`Unknown LLM type: ${type}`);
        }
    }
}
