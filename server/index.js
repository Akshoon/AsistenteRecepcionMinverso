import express from 'express';
import { WebSocketServer } from 'ws';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

import { LLMFactory } from './services/llm/LLMFactory.js';
import { ElevenLabsTTS } from './services/tts/ElevenLabsTTS.js';
import { WhatsAppService } from './services/whatsapp/WhatsAppService.js';
import { createToolHandler } from './tools.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = 3000;

// Middleware para parsear JSON
app.use(express.json());

// CORS para desarrollo con React
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
});

// Servir archivos estáticos del frontend
app.use(express.static(join(__dirname, '../dist')));

// --- Cargar Contexto y Configuración ---
const documentsPath = join(__dirname, 'data/documentos');
let contextDocs = '';

try {
    if (fs.existsSync(documentsPath)) {
        const files = fs.readdirSync(documentsPath);
        console.log(`Cargando ${files.length} documentos para contexto...`);

        for (const file of files) {
            if (file.endsWith('.txt')) {
                const content = fs.readFileSync(join(documentsPath, file), 'utf-8');
                contextDocs += `\n--- CONTENIDO DE ${file} ---\n${content}\n`;
                console.log(`  ${file} cargado`);
            }
        }
    } else {
        console.warn(`Directorio de documentos no encontrado: ${documentsPath}`);
    }
} catch (error) {
    console.warn('No se pudieron cargar documentos:', error.message);
}

let instructions = {};
try {
    const instructionsPath = join(__dirname, 'data/extras/instrucciones.json');
    if (fs.existsSync(instructionsPath)) {
        instructions = JSON.parse(fs.readFileSync(instructionsPath, 'utf-8'));
        console.log('Instrucciones JSON cargadas desde extras/instrucciones.json');
    }
} catch (error) {
    console.warn('Error cargando instrucciones.json:', error.message);
}

const formattedInstructions = Object.entries(instructions)
    .map(([key, value]) => {
        if (typeof value === 'object' && value.description) {
            return `- ${key}: ${value.description}\n  Instrucciones: ${value.instructions || ''}`;
        }
        return `- ${key}: ${value}`;
    })
    .join('\n');

const SYSTEM_INSTRUCTION = `
Eres el asistente virtual de Minverso. Tu objetivo es ayudar a los usuarios con información sobre la empresa y sus servicios.

FECHA Y HORA ACTUAL: ${new Date().toLocaleString('es-CL', { timeZone: 'America/Santiago' })}
DIA DE LA SEMANA: ${new Date().toLocaleDateString('es-CL', { weekday: 'long', timeZone: 'America/Santiago' })}

Usa el siguiente contexto para responder preguntas:
${contextDocs}

Instrucciones adicionales:
${formattedInstructions}

Si te piden realizar una acción específica (como notificar o controlar el showroom), usa las HERRAMIENTAS disponibles.
Responde de manera concisa y natural.
`;

// --- Inicializar Servicios ---

// TTS Service
const ttsService = new ElevenLabsTTS();

// WhatsApp Service
const whatsappEnabled = process.env.WHATSAPP_ENABLED !== 'false';
const whatsappService = whatsappEnabled ? new WhatsAppService({
    headless: process.env.WHATSAPP_HEADLESS !== 'false',
    sessionPath: process.env.WHATSAPP_SESSION_PATH || join(__dirname, 'data/whatsapp-session')
}) : null;

if (whatsappService) {
    console.log('WhatsApp service habilitado');

    // Auto-inicializar WhatsApp en segundo plano para no bloquear el inicio del servidor
    whatsappService.initialize().then(async () => {
        // Esperar autenticación para mostrar logs
        await whatsappService.waitForAuth(60000); // 60 segundos de espera inicial para logs
    }).catch(err => {
        console.error('Error en inicialización automática de WhatsApp:', err);
    });
}


// --- REST API Endpoints para WhatsApp ---

// Inicializar WhatsApp
app.post('/api/whatsapp/init', async (req, res) => {
    if (!whatsappService) {
        return res.status(503).json({ error: 'WhatsApp service not enabled' });
    }

    try {
        await whatsappService.initialize();

        // Esperar autenticación (con timeout de 5 segundos para check inicial)
        const authenticated = await whatsappService.waitForAuth(5000);

        if (authenticated) {
            res.json({ status: 'authenticated', message: 'WhatsApp already authenticated' });
        } else {
            res.json({ status: 'waiting_qr', message: 'Waiting for QR scan' });
        }
    } catch (error) {
        console.error('Error initializing WhatsApp:', error);
        res.status(500).json({ error: error.message });
    }
});

// Obtener estado de WhatsApp
app.get('/api/whatsapp/status', async (req, res) => {
    if (!whatsappService) {
        return res.status(503).json({ error: 'WhatsApp service not enabled' });
    }

    // Verificar estado actual (no solo usar cached)
    await whatsappService.isReady();

    const status = whatsappService.getStatus();
    res.json(status);
});

// Obtener código QR
app.get('/api/whatsapp/qr', async (req, res) => {
    if (!whatsappService) {
        return res.status(503).json({ error: 'WhatsApp service not enabled' });
    }

    try {
        const qrCode = await whatsappService.getQRCode();
        if (qrCode) {
            res.json({ qr: qrCode });
        } else {
            res.json({ qr: null, message: 'No QR code available (already authenticated)' });
        }
    } catch (error) {
        console.error('Error getting QR code:', error);
        res.status(500).json({ error: error.message });
    }
});

// Enviar mensaje de WhatsApp
app.post('/api/whatsapp/send', async (req, res) => {
    if (!whatsappService) {
        return res.status(503).json({ error: 'WhatsApp service not enabled' });
    }

    const { phoneNumber, message } = req.body;

    if (!phoneNumber || !message) {
        return res.status(400).json({ error: 'phoneNumber and message are required' });
    }

    try {
        await whatsappService.sendMessage(phoneNumber, message);
        res.json({ success: true, message: 'Message sent successfully' });
    } catch (error) {
        console.error('Error sending WhatsApp message:', error);
        res.status(500).json({ error: error.message });
    }
});

// --- Iniciar Servidor ---
const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n Servidor iniciado en puerto ${PORT}`);
    console.log(` Accede desde: http://<TU_IP>:${PORT}`);
});

const wss = new WebSocketServer({ server });
console.log('WebSocket server listo');
console.log(`Documentos cargados en contexto: ${contextDocs.length} caracteres`);

wss.on('connection', async (ws) => {
    console.log('Cliente conectado');

    // Crear handler de herramientas con servicios inyectados
    const toolHandler = createToolHandler({ whatsappService });

    // Configurar modo de voz
    const useElevenLabs = ttsService.isConfigured();
    console.log(`Modo de voz: ${useElevenLabs ? 'ElevenLabs' : 'Silencio (ElevenLabs no configurado)'}`);

    // Notificar conexión
    ws.send(JSON.stringify({
        type: 'connected',
        voiceMode: useElevenLabs ? 'elevenlabs' : 'none',
        whatsappStatus: whatsappService ? whatsappService.getStatus() : null
    }));

    // Inicializar LLM Service por conexión
    const llmService = LLMFactory.createLLM('gemini', {
        apiKey: process.env.GOOGLE_API_KEY,
        systemInstruction: SYSTEM_INSTRUCTION,
        toolHandler: toolHandler
    });

    try {
        await llmService.initialize();
    } catch (error) {
        console.error("Error inicializando LLM:", error);
        ws.send(JSON.stringify({ type: 'error', message: 'Error inicializando IA' }));
        ws.close();
        return;
    }

    // Iniciar Chat
    const chatSession = await llmService.startChat();


    // --- Gestión de Audio y Cola ---
    function calculateRMS(buffer) {
        const int16Data = new Int16Array(buffer.buffer, buffer.byteOffset, buffer.length / 2);
        let sum = 0;
        for (let i = 0; i < int16Data.length; i++) {
            const sample = int16Data[i] / 32768.0;
            sum += sample * sample;
        }
        return Math.sqrt(sum / int16Data.length);
    }

    let audioChunks = [];
    let silenceTimer = null;
    let isSpeaking = false;
    const messageQueue = [];
    let isProcessingQueue = false;

    const processQueue = async () => {
        if (isProcessingQueue || messageQueue.length === 0) return;
        isProcessingQueue = true;

        const currentAudioBuffer = messageQueue.shift();
        console.log(`Procesando audio de la cola (${currentAudioBuffer.length} chunks)...`);

        try {
            // Unir chunks
            const buffers = currentAudioBuffer.map(chunk => Buffer.from(chunk, 'base64'));
            const finalPcmBuffer = Buffer.concat(buffers);

            // Llamar al LLM
            console.log('Enviando audio a LLM...');
            const response = await llmService.sendMessage({
                audio: finalPcmBuffer,
                chatSession: chatSession,
                onToolAction: (toolName, result) => {
                    // Manejo específico de efectos secundarios en el cliente
                    if (result && result.action === 'open_whatsapp' && result.whatsappUrl) {
                        console.log(`Enviando comando de apertura de WhatsApp a cliente`);
                        ws.send(JSON.stringify({
                            type: 'whatsapp_notification',
                            url: result.whatsappUrl,
                            contactName: result.contactName || 'Contacto'
                        }));
                    }
                }
            });

            console.log('IA respondió:', response.text || '(Audio respuesta)');

            if (response.text) {
                ws.send(JSON.stringify({ type: 'text', text: response.text }));
            }

            // TTS con ElevenLabs
            if (useElevenLabs && response.text) {
                try {
                    console.log('Enviando a ElevenLabs...');
                    const audioBuffer = await ttsService.textToSpeech(response.text);
                    const audioBase64 = audioBuffer.toString('base64');
                    ws.send(JSON.stringify({
                        type: 'elevenlabs_audio',
                        data: audioBase64
                    }));
                    console.log('Audio ElevenLabs enviado');
                } catch (e) {
                    console.error('Error ElevenLabs:', e);
                }
            }

        } catch (error) {
            console.error('Error en proceso LLM:', error);
            ws.send(JSON.stringify({ type: 'error', message: 'Error procesando solicitud' }));
        } finally {
            isProcessingQueue = false;
            if (messageQueue.length > 0) {
                processQueue();
            }
        }
    };

    ws.on('message', async (data) => {
        try {
            const message = JSON.parse(data);
            if (message.type === 'audio') {
                const chunkBuffer = Buffer.from(message.data, 'base64');
                const rms = calculateRMS(chunkBuffer);
                const SILENCE_THRESHOLD = 0.01;

                if (rms > SILENCE_THRESHOLD) {
                    // DETECTAR INTERRUPCIÓN: Si el usuario empieza a hablar, notificar al cliente para que se calle
                    if (!isSpeaking) {
                        isSpeaking = true;
                        // Enviar señal de interrupción inmediata
                        ws.send(JSON.stringify({ type: 'interrupted' }));
                    }

                    if (silenceTimer) clearTimeout(silenceTimer);

                    silenceTimer = setTimeout(() => {
                        isSpeaking = false;
                        if (audioChunks.length > 0) {
                            messageQueue.push([...audioChunks]);
                            audioChunks = [];
                            processQueue();
                        }
                    }, 1000);
                }

                if (isSpeaking) {
                    audioChunks.push(message.data);
                }
            } else if (message.type === 'text') {
                // Manejar entrada de texto directo (para debug/chat)
                console.log('Recibido texto:', message.text);
                const response = await llmService.sendMessage({
                    text: message.text,
                    chatSession: chatSession
                });

                // Enviar respuesta
                ws.send(JSON.stringify({ type: 'text', text: response.text }));

                // Audio Handling (Native/TTS)
                if (useElevenLabs && response.text) {
                    // ... ElevenLabs logic called via ttsService ...
                    // NOTE: Reusing the same logic block would be better, but for quick insertion:
                    try {
                        const audioBuffer = await ttsService.textToSpeech(response.text);
                        ws.send(JSON.stringify({ type: 'elevenlabs_audio', data: audioBuffer.toString('base64') }));
                    } catch (e) {
                        console.error('TTS Error:', e);
                    }
                } else if (useNativeAudio && response.audioData) {
                    console.log('Enviando audio nativo de Gemini (respuesta a texto)...');
                    ws.send(JSON.stringify({
                        type: 'audio',
                        data: response.audioData
                    }));
                }

            } else if (message.type === 'whatsapp_send' && whatsappService) {
                // Manejar solicitud de envío de WhatsApp desde el cliente
                const { phoneNumber, text } = message;

                if (!phoneNumber || !text) {
                    ws.send(JSON.stringify({
                        type: 'whatsapp_error',
                        error: 'Phone number and text are required'
                    }));
                    return;
                }

                whatsappService.sendMessage(phoneNumber, text)
                    .then(() => {
                        ws.send(JSON.stringify({
                            type: 'whatsapp_sent',
                            success: true,
                            message: 'Message sent successfully'
                        }));
                    })
                    .catch((error) => {
                        console.error('Error sending WhatsApp via WebSocket:', error);
                        ws.send(JSON.stringify({
                            type: 'whatsapp_error',
                            error: error.message
                        }));
                    });
            }
        } catch (e) {
            console.error('Error parsing message:', e);
        }
    });

    ws.on('close', () => {
        console.log('Cliente desconectado');
        if (silenceTimer) clearTimeout(silenceTimer);
    });
});
