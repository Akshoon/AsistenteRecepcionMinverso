/**
 * Base abstract class for LLM Services.
 * Defines the contract that all LLM implementations must follow.
 */
export class BaseLLM {
    constructor(config) {
        this.config = config;
    }

    /**
     * Initialize the model and any necessary clients.
     */
    async initialize() {
        throw new Error("Method 'initialize' must be implemented.");
    }

    /**
     * Create a new chat session.
     * @param {Object} options - Options for the chat session (e.g., history).
     */
    async startChat(options = {}) {
        throw new Error("Method 'startChat' must be implemented.");
    }

    /**
     * Send a message to the LLM and get a response.
     * @param {Object} params - The message parameters.
     * @param {string} params.text - The text message (optional if audio provided).
     * @param {string} params.audio - Base64 audio data (optional).
     * @param {Object} params.session - The current chat session object.
     * @returns {Promise<Object>} - The response object containing text and/or audio.
     */
    async sendMessage(params) {
        throw new Error("Method 'sendMessage' must be implemented.");
    }
}
