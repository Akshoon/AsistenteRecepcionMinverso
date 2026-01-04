import { BaseLLM } from './BaseLLM.js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { tools } from '../../tools.js';

// Helper: PCM to WAV (Native Gemini requirement)
function pcmToWav(pcmData, sampleRate = 16000) {
    const numChannels = 1;
    const byteRate = sampleRate * numChannels * 2;
    const blockAlign = numChannels * 2;
    const dataSize = pcmData.length;
    const buffer = Buffer.alloc(44 + dataSize);

    // RIFF chunk
    buffer.write('RIFF', 0);
    buffer.writeUInt32LE(36 + dataSize, 4);
    buffer.write('WAVE', 8);

    // fmt chunk
    buffer.write('fmt ', 12);
    buffer.writeUInt32LE(16, 16); // subchunk1Size
    buffer.writeUInt16LE(1, 20); // audioFormat (1 = PCM)
    buffer.writeUInt16LE(numChannels, 22);
    buffer.writeUInt32LE(sampleRate, 24);
    buffer.writeUInt32LE(byteRate, 28);
    buffer.writeUInt16LE(blockAlign, 32);
    buffer.writeUInt16LE(16, 34); // bitsPerSample

    // data chunk
    buffer.write('data', 36);
    buffer.writeUInt32LE(dataSize, 40);
    pcmData.copy(buffer, 44);

    return buffer;
}

export class GeminiLLMService extends BaseLLM {
    constructor(config) {
        super(config);
        this.apiKey = config.apiKey;
        this.systemInstruction = config.systemInstruction;
        this.toolHandler = config.toolHandler; // Inject tool handler
        this.genAI = null;
        this.model = null;
    }

    async initialize() {
        if (!this.apiKey) throw new Error("API Key es necesaria para GeminiLLMService");

        this.genAI = new GoogleGenerativeAI(this.apiKey);

        // Map tools to new SDK format
        const toolsConfig = [
            {
                functionDeclarations: tools[0].functionDeclarations.map(tool => ({
                    name: tool.name,
                    description: tool.description,
                    parameters: tool.parameters
                }))
            }
        ];

        this.model = this.genAI.getGenerativeModel({
            model: "gemini-2.5-flash",
            systemInstruction: this.systemInstruction,
            tools: toolsConfig
        });

        console.log('Inicializando Gemini con modelo: gemini-2.5-flash');
    }

    startChat(options = {}) {
        if (!this.model) throw new Error("Modelo no inicializado. Llame a initialize() primero.");

        return this.model.startChat({
            history: options.history || [],
            generationConfig: {
                maxOutputTokens: 1024,
                temperature: 0.2
            },
        });
    }

    async sendMessage({ text, audio, chatSession, onToolAction }) {
        if (!chatSession) throw new Error("Se requiere sesion de chat");

        let msgParts = [];
        if (audio) {
            // Audio is expected to be PCM Buffer. Convert to WAV Base64
            const wavBuffer = pcmToWav(audio);
            const wavBase64 = wavBuffer.toString('base64');
            msgParts.push({
                inlineData: {
                    mimeType: "audio/wav",
                    data: wavBase64
                }
            });
        }

        if (text) {
            msgParts.push(text);
        }

        let result = await chatSession.sendMessage(msgParts);
        let response = await result.response;

        // Handle Function Calls
        let functionCalls = response.functionCalls();
        let responseText = "";

        // Only try to get text if NO function calls
        if (!functionCalls || functionCalls.length === 0) {
            try {
                responseText = response.text();
            } catch (e) {
                console.warn("Could not get text from response:", e.message);
            }
        }

        while (functionCalls && functionCalls.length > 0) {
            for (const call of functionCalls) {
                console.log('Llamada a herramienta:', call.name, call.args);

                let toolResult;
                if (this.toolHandler) {
                    toolResult = await this.toolHandler(call);
                } else {
                    console.warn("No toolHandler configured, returning empty result");
                    toolResult = { error: "Tool handler not configured" };
                }

                console.log(`Resultado herramienta ${call.name}:`, JSON.stringify(toolResult));

                if (onToolAction && toolResult) {
                    onToolAction(call.name, toolResult);
                }

                const result2 = await chatSession.sendMessage([
                    {
                        functionResponse: {
                            name: call.name,
                            response: toolResult
                        }
                    }
                ]);

                response = await result2.response;
                responseText = response.text();
            }
            functionCalls = response.functionCalls();
        }

        return {
            text: responseText
        };
    }
}
