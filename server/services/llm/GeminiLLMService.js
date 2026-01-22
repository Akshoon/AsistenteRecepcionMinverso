import { BaseLLM } from './BaseLLM.js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { tools } from '../../tools.js';

/**
 * GeminiLLMService - Servicio para lógica y function calling
 * Usa gemini-2.5-flash para procesamiento de texto y herramientas
 * 
 * Responsabilidades:
 * - Procesar texto entrante
 * - Manejar function calling (tools)
 * - Generar respuestas de texto
 * 
 * NO maneja: audio (eso es responsabilidad de GeminiAudioService)
 * 
 * ⚠️ IMPORTANTE:
 * - UNA sesión por usuario (no recrear por mensaje)
 * - Límite de iteraciones de tools
 * - Retry con backoff para 503
 */

// Constantes de configuración
const MAX_TOOL_ITERATIONS = 5;
const RETRY_ATTEMPTS = 3;
const INITIAL_RETRY_DELAY = 300;

export class GeminiLLMService extends BaseLLM {
    constructor(config) {
        super(config);
        this.apiKey = config.apiKey;
        this.systemInstruction = config.systemInstruction;
        this.toolHandler = config.toolHandler;
        this.genAI = null;
        this.model = null;

        // Cache de tools configurados (no mutar en runtime)
        this.toolsConfig = null;
    }

    async initialize() {
        if (!this.apiKey) throw new Error("API Key es necesaria para GeminiLLMService");

        this.genAI = new GoogleGenerativeAI(this.apiKey);

        // Configurar tools para function calling (UNA VEZ, no mutar después)
        this.toolsConfig = [
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
            tools: this.toolsConfig
        });

        console.log('GeminiLLMService: Inicializado con gemini-2.5-flash (texto + tools)');
    }

    /**
     * Inicia una sesión de chat PERSISTENTE
     * ⚠️ SOLO llamar UNA VEZ por usuario/conexión
     */
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

    /**
     * Helper para extraer texto de forma segura
     * @private
     */
    _safeGetText(response) {
        try {
            return response.text() || "";
        } catch (e) {
            console.warn('GeminiLLMService: Error extrayendo texto:', e.message);
            return "";
        }
    }

    /**
     * Wrapper con retry y backoff exponencial para 503
     * @private
     */
    async _withRetry(fn, context = 'operación') {
        let delay = INITIAL_RETRY_DELAY;

        for (let attempt = 0; attempt < RETRY_ATTEMPTS; attempt++) {
            try {
                return await fn();
            } catch (error) {
                const is503 = error.status === 503 ||
                    error.message?.includes('503') ||
                    error.message?.includes('overloaded');

                if (is503 && attempt < RETRY_ATTEMPTS - 1) {
                    console.warn(`GeminiLLMService: 503 en ${context}, retry ${attempt + 1}/${RETRY_ATTEMPTS} en ${delay}ms`);
                    await new Promise(r => setTimeout(r, delay));
                    delay *= 2; // Backoff exponencial
                } else {
                    throw error;
                }
            }
        }
    }

    /**
     * Envía un mensaje de texto y procesa function calls
     * @param {Object} params - Parámetros
     * @param {string} params.text - Texto a procesar
     * @param {Object} params.chatSession - Sesión de chat activa (REUSAR, no crear nueva)
     * @param {Function} params.onToolAction - Callback opcional para acciones de tools
     * @returns {Promise<{text: string}>} - Respuesta de texto
     */
    async sendMessage({ text, chatSession, onToolAction }) {
        if (!chatSession) throw new Error("Se requiere sesión de chat");
        if (!text) throw new Error("Se requiere texto para procesar");

        console.log('GeminiLLMService: Procesando texto:', text.substring(0, 100) + '...');

        // Enviar mensaje con retry
        let result = await this._withRetry(
            () => chatSession.sendMessage([text]),
            'sendMessage inicial'
        );
        let response = await result.response;

        // Manejar Function Calls
        let functionCalls = response.functionCalls();
        let responseText = "";

        // Solo obtener texto si NO hay function calls
        if (!functionCalls || functionCalls.length === 0) {
            responseText = this._safeGetText(response);
        }

        // Procesar function calls en loop CON LÍMITE
        let toolIterations = 0;

        while (functionCalls && functionCalls.length > 0 && toolIterations < MAX_TOOL_ITERATIONS) {
            toolIterations++;
            console.log(`GeminiLLMService: Iteración de tools ${toolIterations}/${MAX_TOOL_ITERATIONS} (${functionCalls.length} calls)`);

            // Ejecutar TODOS los tool calls en PARALELO
            const toolResults = await Promise.all(functionCalls.map(async (call) => {
                console.log('GeminiLLMService: Tool call:', call.name, call.args);

                let result;
                if (this.toolHandler) {
                    try {
                        result = await this.toolHandler(call);
                    } catch (toolError) {
                        console.error(`GeminiLLMService: Error en tool ${call.name}:`, toolError);
                        result = { error: `Error ejecutando ${call.name}: ${toolError.message}` };
                    }
                } else {
                    console.warn("No hay toolHandler configurado");
                    result = { error: "Tool handler not configured" };
                }

                console.log(`GeminiLLMService: Tool result ${call.name}:`, JSON.stringify(result).substring(0, 200));

                // Callback para efectos secundarios
                if (onToolAction && result) {
                    onToolAction(call.name, result);
                }

                return {
                    functionResponse: {
                        name: call.name,
                        response: result
                    }
                };
            }));

            // Enviar TODOS los resultados de vuelta en un solo mensaje
            const result2 = await this._withRetry(
                () => chatSession.sendMessage(toolResults),
                `functionResponses (${functionCalls.length} tools)`
            );

            response = await result2.response;
            responseText = this._safeGetText(response);
            functionCalls = response.functionCalls();
        }

        // Advertir si se alcanzó el límite
        if (toolIterations >= MAX_TOOL_ITERATIONS) {
            console.warn(`GeminiLLMService: LÍMITE de ${MAX_TOOL_ITERATIONS} iteraciones de tools alcanzado`);
        }

        console.log('GeminiLLMService: Respuesta:', responseText.substring(0, 100) + '...');

        return {
            text: responseText
        };
    }
}
