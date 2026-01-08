/**
 * GeminiAudioService - Servicio de Audio en Tiempo Real (STREAMING)
 * 
 * IMPORTANTE: Este modelo es LIVE, no request/response.
 * - La sesión debe mantenerse viva
 * - Audio se envía en chunks (streaming)
 * - STT llega por eventos (onmessage)
 * - TTS se envía con sendResponse
 * - COMMIT requerido para finalizar audio input
 * 
 * Modelo: gemini-2.5-flash-native-audio-dialog
 * API: Live API (WebSocket)
 * 
 * ⚠️ NO soporta: systemInstruction, tools, functions
 */

import { GoogleGenAI, Modality } from '@google/genai';

export class GeminiAudioService {
    constructor(config) {
        this.apiKey = config.apiKey;
        this.client = null;
        this.session = null;
        this.isConnected = false;

        // Callbacks para eventos
        this.onTranscript = null;  // Llamado cuando hay transcripción (STT)
        this.onThought = null;     // Llamado cuando hay pensamientos/texto del modelo
        this.onAudio = null;       // Llamado cuando hay audio de respuesta (TTS)
        this.onError = null;       // Llamado en errores
        this.onInterrupted = null; // Llamado cuando se interrumpe
        this.onClose = null;       // Llamado cuando se desconecta

        // Estado interno
        this.currentTranscript = '';
        this.audioChunks = [];
    }

    /**
     * Inicializa el cliente
     */
    async initialize() {
        if (!this.apiKey) {
            throw new Error("API Key es necesaria para GeminiAudioService");
        }
        try {
            this.client = new GoogleGenAI({ apiKey: this.apiKey });
            console.log('GeminiAudioService: Cliente inicializado');
        } catch (e) {
            console.error('Error inicializando GoogleGenAI:', e);
            throw e;
        }
    }

    /**
     * Conecta a la sesión Live API (debe llamarse UNA VEZ y mantenerse viva)
     * Basado en código de referencia funcional
     */
    async connect(systemInstruction = null) {
        if (this.session && this.isConnected) {
            console.log('GeminiAudioService: Ya conectado');
            return true;
        }

        if (!this.client) {
            await this.initialize();
        }

        try {
            // Modelo correcto según documentación oficial de Google
            const model = 'gemini-2.5-flash-native-audio-preview-12-2025';

            // Config para Live API con audio nativo
            // Referencia: https://ai.google.dev/gemini-api/docs/live
            const config = {
                // Responder con audio (el modelo genera voz directamente)
                responseModalities: [Modality.AUDIO],
                // Configuración de voz para el output
                speechConfig: {
                    voiceConfig: {
                        prebuiltVoiceConfig: {
                            voiceName: 'Aoede' // Voz disponible para español
                        }
                    }
                }
            };

            // systemInstruction SÍ está soportado
            if (systemInstruction) {
                config.systemInstruction = systemInstruction;
            }

            console.log(`GeminiAudioService: Conectando a ${model}...`);
            // console.log('GeminiAudioService: Config:', JSON.stringify(config, null, 2));

            this.session = await this.client.live.connect({
                model: model,
                config: config,
                callbacks: {
                    onopen: () => {
                        console.log('GeminiAudioService: ✓ Sesión Live abierta');
                        this.isConnected = true;
                    },
                    onmessage: (message) => {
                        this._handleMessage(message);
                    },
                    onerror: (e) => {
                        console.error('GeminiAudioService Error:', e);
                        if (this.onError) this.onError(e);
                    },
                    onclose: (e) => {
                        console.log('GeminiAudioService: Sesión cerrada:', e?.reason || 'sin razón');
                        this.isConnected = false;
                        this.session = null;
                        if (this.onClose) this.onClose(e);
                    },
                },
            });

            // Esperar a que se conecte
            await new Promise(resolve => setTimeout(resolve, 500));

            if (!this.isConnected) {
                throw new Error('La sesión se cerró inmediatamente');
            }

            console.log('GeminiAudioService: ✓ Sesión Live lista para streaming');
            return true;

        } catch (error) {
            console.error('Error conectando a Live API:', error);
            this.isConnected = false;
            throw error;
        }
    }

    /**
     * Maneja mensajes entrantes de la sesión Live
     * @private
     */
    _handleMessage(message) {
        // DEBUG: Log todos los mensajes para diagnóstico
        // console.log('[GeminiAudio] Mensaje recibido:', JSON.stringify(message, null, 2).substring(0, 500));

        // Interrupción
        if (message.serverContent && message.serverContent.interrupted) {
            console.log('GeminiAudioService: Respuesta interrumpida - sesión sigue activa');
            this.audioChunks = [];
            if (this.onInterrupted) this.onInterrupted();
            return;
        }

        // --- DETECCIÓN DE TRANSCRIPT DE USUARIO (STT) ---
        // Verificar si hay toolUse (algunos modelos lo usan para STT implícito) o content directo
        if (message.clientContent) {
            console.log('[GeminiAudio] ClientContent recibido:', JSON.stringify(message.clientContent));
        }

        // Contenido del modelo
        if (message.serverContent && message.serverContent.modelTurn && message.serverContent.modelTurn.parts) {
            // console.log('[GeminiAudio] ModelTurn con', message.serverContent.modelTurn.parts.length, 'parts');
            for (const part of message.serverContent.modelTurn.parts) {
                // Texto (transcripción, respuesta o PENSAMIENTO)
                if (part.text) {
                    const text = part.text.trim();
                    if (text) {
                        console.log('[GeminiAudio] Pentamiento/Texto:', text);

                        // Emitir pensamiento para que el sistema Híbrido lo analice
                        if (this.onThought) {
                            this.onThought(text);
                        }
                    }
                }

                // Audio (TTS)
                if (part.inlineData && part.inlineData.data) {
                    const chunk = Buffer.from(part.inlineData.data, 'base64');
                    this.audioChunks.push(chunk);

                    // Enviar chunk de audio inmediatamente
                    if (this.onAudio) {
                        this.onAudio(chunk);
                    }
                }
            }
        }

        // Turno completo
        if (message.serverContent && message.serverContent.turnComplete) {
            console.log('[GeminiAudio] TurnComplete');
            this.currentTranscript = '';
            this.audioChunks = [];
        }
    }

    /**
     * Envía un chunk de audio al modelo (streaming)
     * @param {Buffer} pcmChunk - Chunk de audio PCM 16-bit, 16kHz, mono
     */
    sendAudioChunk(pcmChunk) {
        if (!this.session || !this.isConnected) {
            console.warn('GeminiAudioService: No conectado, ignorando audio chunk');
            return false;
        }

        // Contador de chunks para debug
        if (!this.chunkCount) this.chunkCount = 0;
        this.chunkCount++;

        try {
            const audioBase64 = pcmChunk.toString('base64');

            // Log cada 10 chunks para no saturar
            if (this.chunkCount % 10 === 1) {
                console.log(`[GeminiAudio] Enviando chunk #${this.chunkCount} (${pcmChunk.length} bytes)`);
            }

            // Usar 'media' según documentación de Live API
            this.session.sendRealtimeInput({
                media: {
                    mimeType: 'audio/pcm;rate=16000',
                    data: audioBase64
                }
            });

            return true;
        } catch (error) {
            console.error('Error enviando audio chunk:', error);
            return false;
        }
    }

    /**
     * ⚠️ DEPRECADO - NO se usa en Live API
     * El modelo detecta automáticamente el fin de audio por silencio.
     * Método mantenido solo por compatibilidad.
     */
    commitAudio() {
        // No hace nada - el modelo maneja esto automáticamente
        return true;
    }

    /**
     * Envía múltiples chunks de audio (buffer completo)
     * @param {Buffer} pcmBuffer - Buffer de audio PCM completo
     */
    sendAudioBuffer(pcmBuffer) {
        if (!this.session || !this.isConnected) {
            console.warn('GeminiAudioService: No conectado, ignorando audio buffer');
            return false;
        }

        try {
            const audioBase64 = pcmBuffer.toString('base64');

            // ✅ CORRECCIÓN: usar 'media' en lugar de 'audio'
            this.session.sendRealtimeInput({
                media: {
                    mimeType: 'audio/pcm;rate=16000',
                    data: audioBase64
                }
            });

            console.log(`GeminiAudioService: Enviado buffer de ${pcmBuffer.length} bytes`);
            return true;
        } catch (error) {
            console.error('Error enviando audio buffer:', error);
            return false;
        }
    }

    /**
     * Envía texto al modelo para que genere respuesta en audio (TTS)
     * El modelo native-audio-preview puede recibir texto y responder con audio.
     * 
     * @param {string} text - Texto para convertir a audio
     * @returns {boolean} - true si se envió exitosamente
     */
    sendTextForTTS(text) {
        if (!this.session || !this.isConnected) {
            console.warn('GeminiAudioService: No conectado, no se puede enviar texto para TTS');
            return false;
        }

        if (!text || text.trim() === '') {
            console.warn('GeminiAudioService: Texto vacío, ignorando');
            return false;
        }

        try {
            // Enviar texto como entrada al modelo Live
            this.session.sendRealtimeInput({
                text: text
            });

            console.log(`GeminiAudioService TTS: Enviado texto "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"}`);
            return true;
        } catch (error) {
            console.error('Error enviando texto para TTS:', error);
            return false;
        }
    }

    /**
     * Configura el callback para recibir pensamientos/texto
     * @param {Function} callback - function(text: string)
     */
    setThoughtCallback(callback) {
        this.onThought = callback;
    }

    /**
     * Configura el callback para recibir transcripciones (STT)
     * @param {Function} callback - function(text: string)
     */
    setTranscriptCallback(callback) {
        this.onTranscript = callback;
    }

    /**
     * Configura el callback para recibir audio (TTS)
     * @param {Function} callback - function(audioChunk: Buffer)
     */
    setAudioCallback(callback) {
        this.onAudio = callback;
    }

    /**
     * Configura el callback para errores
     * @param {Function} callback - function(error: Error)
     */
    setErrorCallback(callback) {
        this.onError = callback;
    }

    /**
     * Configura el callback para interrupciones
     * @param {Function} callback - function()
     */
    setInterruptedCallback(callback) {
        this.onInterrupted = callback;
    }

    /**
     * Configura el callback para desconexión
     * @param {Function} callback - function(event)
     */
    setCloseCallback(callback) {
        this.onClose = callback;
    }

    /**
     * Desconecta la sesión
     */
    disconnect() {
        if (this.session) {
            try {
                this.session.close();
            } catch (e) {
                console.warn('Error cerrando sesión:', e.message);
            }
            this.session = null;
            this.isConnected = false;
            console.log('GeminiAudioService: Desconectado');
        }
    }

    /**
     * Verifica si está conectado y listo
     */
    isReady() {
        return this.isConnected && this.session !== null;
    }
}
