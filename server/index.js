import express from 'express';
import https from 'https';
import { WebSocketServer } from 'ws';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

import { LLMFactory } from './services/llm/LLMFactory.js';
import { ElevenLabsTTS } from './services/tts/ElevenLabsTTS.js';
import { WhatsAppService } from './services/whatsapp/WhatsAppService.js';
import { createToolHandler } from './tools.js';
import { initializeServices, getIoTService, getDataService, serviceRegistry } from './services/initServices.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuración de certificados SSL
const SSL_PFX_PATH = process.env.SSL_PFX_PATH || (process.platform === 'win32' ? 'C:\\certificados\\minverso.pfx' : '/home/ubuntu/minverso.pfx');
const SSL_PASSPHRASE = process.env.SSL_PASSPHRASE || 'minverso123';

const app = express();
const PORT = process.env.PORT || 3000;
const isWindows = process.platform === 'win32';

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

// --- Funciones para Cargar ConfiguraciÃ³n DinÃ¡mica ---

function loadContextDocs() {
    const documentsPath = join(__dirname, 'data/documentos');
    let contextDocs = '';
    try {
        if (fs.existsSync(documentsPath)) {
            const files = fs.readdirSync(documentsPath);
            // Limit log noise
            // console.log(`Cargando ${files.length} documentos para contexto...`);
            for (const file of files) {
                if (file.endsWith('.txt')) {
                    const content = fs.readFileSync(join(documentsPath, file), 'utf-8');
                    contextDocs += `\n--- CONTENIDO DE ${file} ---\n${content}\n`;
                }
            }
        }
    } catch (error) {
        console.warn('No se pudieron cargar documentos:', error.message);
    }
    return contextDocs;
}

function getFormattedInstructions() {
    let instructions = {};
    try {
        const instructionsPath = join(__dirname, 'data/extras/instrucciones.json');
        if (fs.existsSync(instructionsPath)) {
            instructions = JSON.parse(fs.readFileSync(instructionsPath, 'utf-8'));
        }
    } catch (error) {
        console.warn('Error cargando instrucciones.json:', error.message);
    }

    return Object.entries(instructions)
        .map(([key, value]) => {
            if (typeof value === 'object' && value.description) {
                let formatted = `- ${key}: ${value.description}`;
                if (value.instructions) {
                    formatted += `\n  Instrucciones: ${value.instructions}`;
                }
                if (value.commands && Array.isArray(value.commands)) {
                    value.commands.forEach(cmd => {
                        formatted += `\n  - Comando: "${cmd.id}"`;
                        formatted += `\n    Frases: ${cmd.triggers.join(', ')}`;
                        formatted += `\n    Respuesta sugerida: "${cmd.response}"`;
                        formatted += `\n    Acción: Tool "${cmd.tool}" con args ${JSON.stringify(cmd.args)}`;
                    });
                }
                return formatted;
            }
            return `- ${key}: ${value}`;
        })
        .join('\n');
}

function getFormattedContacts() {
    let phoneNumbers = {};
    try {
        const phonesPath = join(__dirname, 'data/extras/phone_number.json');
        if (fs.existsSync(phonesPath)) {
            phoneNumbers = JSON.parse(fs.readFileSync(phonesPath, 'utf-8'));
        }
    } catch (error) {
        console.warn('Error cargando phone_number.json:', error.message);
    }

    return Object.entries(phoneNumbers)
        .map(([name, number]) => `- ${name}: ${number}`)
        .join('\n');
}

function generateSystemInstruction() {
    const contextDocs = loadContextDocs();
    const formattedInstructions = getFormattedInstructions();
    const formattedContacts = getFormattedContacts();

    return `
Eres el asistente virtual de Minverso. Tu objetivo es ayudar a los usuarios con información sobre la empresa y sus servicios.

FECHA Y HORA ACTUAL: ${new Date().toLocaleString('es-CL', { timeZone: 'America/Santiago' })}
DIA DE LA SEMANA: ${new Date().toLocaleDateString('es-CL', { weekday: 'long', timeZone: 'America/Santiago' })}

ESTILO DE RESPUESTA:
- Responde de forma MUY BREVE y directa, máximo 1-2 oraciones.
- No des explicaciones largas ni detalles innecesarios.
- Si el tema tiene más información disponible, pregunta: "¿Quieres que te cuente más?"
- Solo expande la información si el usuario lo pide explícitamente.
- Evita emojis y símbolos especiales.

Usa el siguiente contexto para responder preguntas:
${contextDocs}

Instrucciones adicionales:
${formattedInstructions}

CONTACTOS DISPONIBLES (Para notificaciones de WhatsApp):
${formattedContacts}

Si te piden realizar una acción específica (como notificar o controlar dispositivos), CONFIRMA que lo harás.
`;
}

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
    console.log('GET /api/whatsapp/qr request received');
    if (!whatsappService) {
        return res.status(503).json({ error: 'WhatsApp service not enabled' });
    }

    try {
        const qrCode = await whatsappService.getQRCode();
        if (qrCode) {
            console.log('Sending QR code to client (length: ' + qrCode.length + ')');
            res.json({ qr: qrCode });
        } else {
            console.log('No QR code returned from service');
            res.json({ qr: null, message: 'No QR code available (already authenticated)' });
        }
    } catch (error) {
        console.error('Error in /api/whatsapp/qr:', error);
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

// --- Configuration API Endpoints ---

// Get current instructions configuration
app.get('/api/config/instructions', (req, res) => {
    try {
        const instructionsPath = join(__dirname, 'data/extras/instrucciones.json');
        if (!fs.existsSync(instructionsPath)) {
            return res.status(404).json({ error: 'Configuration file not found' });
        }

        const data = fs.readFileSync(instructionsPath, 'utf-8');
        const config = JSON.parse(data);
        res.json(config);
    } catch (error) {
        console.error('Error reading configuration:', error);
        res.status(500).json({ error: error.message });
    }
});

// Save instructions configuration
app.post('/api/config/instructions', (req, res) => {
    try {
        const instructionsPath = join(__dirname, 'data/extras/instrucciones.json');

        // Validate JSON structure
        const newConfig = req.body;
        if (!newConfig || typeof newConfig !== 'object') {
            return res.status(400).json({ error: 'Invalid configuration format' });
        }

        // Backup current file before saving
        const backupPath = join(__dirname, 'data/extras/instrucciones.backup.json');
        if (fs.existsSync(instructionsPath)) {
            fs.copyFileSync(instructionsPath, backupPath);
        }

        // Save new configuration
        fs.writeFileSync(instructionsPath, JSON.stringify(newConfig, null, 4), 'utf-8');
        console.log('Configuration saved successfully');

        res.json({ success: true, message: 'Configuration saved successfully' });
    } catch (error) {
        console.error('Error saving configuration:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get phone numbers
app.get('/api/config/phones', (req, res) => {
    try {
        const phonePath = join(__dirname, 'data/extras/phone_number.json');
        if (!fs.existsSync(phonePath)) {
            return res.json({});
        }

        const data = fs.readFileSync(phonePath, 'utf-8');
        const phones = JSON.parse(data);
        res.json(phones);
    } catch (error) {
        console.error('Error reading phone numbers:', error);
        res.status(500).json({ error: error.message });
    }
});

// Save phone numbers
app.post('/api/config/phones', (req, res) => {
    try {
        const phonePath = join(__dirname, 'data/extras/phone_number.json');

        const newPhones = req.body;
        if (!newPhones || typeof newPhones !== 'object') {
            return res.status(400).json({ error: 'Invalid phone format' });
        }

        // Backup
        const backupPath = join(__dirname, 'data/extras/phone_number.backup.json');
        if (fs.existsSync(phonePath)) {
            fs.copyFileSync(phonePath, backupPath);
        }

        fs.writeFileSync(phonePath, JSON.stringify(newPhones, null, 4), 'utf-8');
        console.log('Phone numbers saved successfully');

        res.json({ success: true, message: 'Phone numbers saved successfully' });
    } catch (error) {
        console.error('Error saving phone numbers:', error);
        res.status(500).json({ error: error.message });
    }
});

// --- IoT API Endpoints ---

// Listar dispositivos IoT
app.get('/api/iot/devices', (req, res) => {
    const iotService = getIoTService();
    if (!iotService) {
        return res.status(503).json({ error: 'IoT service not available' });
    }
    res.json(iotService.listDevices());
});

// Estado de dispositivo específico
app.get('/api/iot/devices/:id', (req, res) => {
    const iotService = getIoTService();
    if (!iotService) {
        return res.status(503).json({ error: 'IoT service not available' });
    }

    const device = iotService.getDeviceStatus(req.params.id);
    if (!device) {
        return res.status(404).json({ error: 'Device not found' });
    }
    res.json(device);
});

// Ejecutar acción en dispositivo
app.post('/api/iot/devices/:id/:action', async (req, res) => {
    const iotService = getIoTService();
    if (!iotService) {
        return res.status(503).json({ error: 'IoT service not available' });
    }

    const { id, action } = req.params;
    const result = await iotService.executeAction(id, action);

    if (result.error) {
        return res.status(400).json(result);
    }
    res.json(result);
});

// Proxy para acciones IoT (URL simple)
app.post('/api/iot/action', async (req, res) => {
    const { url } = req.body;
    if (!url) {
        return res.status(400).json({ error: 'URL is required' });
    }

    console.log(`[IoT Proxy] Executing GET ${url}`);

    try {
        // Usar fetch nativo (Node 18+)
        const response = await fetch(url);

        if (response.ok) {
            res.json({ success: true, message: 'Action executed successfully' });
        } else {
            console.warn(`[IoT Proxy] Error executing action: ${response.status} ${response.statusText}`);
            // No fallar completamente si el dispositivo no devuelve JSON o 200 estricto, 
            // pero informar status. Muchos dispositivos IoT antiguos devuelven texto plano.
            res.json({ success: response.ok, status: response.status });
        }
    } catch (error) {
        console.error('[IoT Proxy] Error:', error.message);
        // Si falla la conexión, retornar error pero 200 en http para que el frontend lo maneje
        res.json({ success: false, error: error.message });
    }
});

// Historial de comandos IoT
app.get('/api/iot/history', (req, res) => {
    const iotService = getIoTService();
    if (!iotService) {
        return res.status(503).json({ error: 'IoT service not available' });
    }

    const limit = parseInt(req.query.limit) || 10;
    res.json(iotService.getHistory(limit));
});

// --- Integrations Config API ---

// Get integrations configuration
app.get('/api/config/integrations', (req, res) => {
    try {
        const configPath = join(__dirname, 'data/extras/integrations_config.json');
        if (!fs.existsSync(configPath)) {
            return res.status(404).json({ error: 'Integrations config not found' });
        }
        const data = fs.readFileSync(configPath, 'utf-8');
        res.json(JSON.parse(data));
    } catch (error) {
        console.error('Error reading integrations config:', error);
        res.status(500).json({ error: error.message });
    }
});

// Save integrations configuration
app.post('/api/config/integrations', (req, res) => {
    try {
        const configPath = join(__dirname, 'data/extras/integrations_config.json');
        const backupPath = join(__dirname, 'data/extras/integrations_config.backup.json');

        // Backup
        if (fs.existsSync(configPath)) {
            fs.copyFileSync(configPath, backupPath);
        }

        fs.writeFileSync(configPath, JSON.stringify(req.body, null, 4), 'utf-8');
        console.log('Integrations config saved');

        res.json({ success: true, message: 'Integrations config saved' });
    } catch (error) {
        console.error('Error saving integrations config:', error);
        res.status(500).json({ error: error.message });
    }
});

// --- Documents API ---

// Get all documents
app.get('/api/config/documents', (req, res) => {
    try {
        const documentsPath = join(__dirname, 'data/documentos');
        if (!fs.existsSync(documentsPath)) {
            return res.json([]);
        }

        const files = fs.readdirSync(documentsPath)
            .filter(file => file.endsWith('.txt'))
            .map(file => ({
                name: file,
                size: fs.statSync(join(documentsPath, file)).size,
                modified: fs.statSync(join(documentsPath, file)).mtime
            }));

        res.json(files);
    } catch (error) {
        console.error('Error reading documents:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get specific document
app.get('/api/config/documents/:filename', (req, res) => {
    try {
        const documentsPath = join(__dirname, 'data/documentos');
        const filePath = join(documentsPath, req.params.filename);

        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'Document not found' });
        }

        const content = fs.readFileSync(filePath, 'utf-8');
        res.json({ filename: req.params.filename, content });
    } catch (error) {
        console.error('Error reading document:', error);
        res.status(500).json({ error: error.message });
    }
});

// Save document
app.post('/api/config/documents', (req, res) => {
    try {
        const { filename, content } = req.body;

        if (!filename || content === undefined) {
            return res.status(400).json({ error: 'Filename and content are required' });
        }

        const documentsPath = join(__dirname, 'data/documentos');
        if (!fs.existsSync(documentsPath)) {
            fs.mkdirSync(documentsPath, { recursive: true });
        }

        const filePath = join(documentsPath, filename);
        fs.writeFileSync(filePath, content, 'utf-8');

        res.json({ success: true, message: 'Document saved' });
    } catch (error) {
        console.error('Error saving document:', error);
        res.status(500).json({ error: error.message });
    }
});

// Delete document
app.delete('/api/config/documents/:filename', (req, res) => {
    try {
        const documentsPath = join(__dirname, 'data/documentos');
        const filePath = join(documentsPath, req.params.filename);

        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'Document not found' });
        }

        fs.unlinkSync(filePath);
        res.json({ success: true, message: 'Document deleted' });
    } catch (error) {
        console.error('Error deleting document:', error);
        res.status(500).json({ error: error.message });
    }
});

// --- Devices API ---

// Get available serial ports
app.get('/api/devices/serial-ports', async (req, res) => {
    try {
        // Placeholder: En producción, usar SerialPort.list() de 'serialport'
        // Por ahora retornamos un array vacío
        res.json([]);
    } catch (error) {
        console.error('Error listing serial ports:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get available cameras
app.get('/api/devices/cameras', async (req, res) => {
    try {
        // Placeholder: En producción, enumerar dispositivos de video
        // Por ahora retornamos un array vacío
        res.json([]);
    } catch (error) {
        console.error('Error listing cameras:', error);
        res.status(500).json({ error: error.message });
    }
});

// --- Services Status API ---

// Estado de todos los servicios
app.get('/api/services/status', (req, res) => {
    res.json(serviceRegistry.getStatus());
});

// --- Inicializar Servicios ---
console.log('\n📦 Inicializando servicios...');
initializeServices({ whatsappService }).then(() => {
    console.log('✅ Servicios inicializados\n');
}).catch(err => {
    console.error('⚠️ Error inicializando servicios:', err);
});

// --- Configurar Servidor (HTTPS preferido para Micrófono) ---
let server;

if (fs.existsSync(SSL_PFX_PATH)) {
    try {
        const httpsOptions = {
            pfx: fs.readFileSync(SSL_PFX_PATH),
            passphrase: SSL_PASSPHRASE
        };
        server = https.createServer(httpsOptions, app);
        server.listen(PORT, '0.0.0.0', () => {
            console.log(`\n 🔒 Servidor HTTPS iniciado en puerto ${PORT}`);
            console.log(` Certificado cargado desde: ${SSL_PFX_PATH}`);
        });
    } catch (error) {
        console.error('❌ Error cargando certificado SSL:', error.message);
        process.exit(1); // Error crítico si se requiere HTTPS
    }
} else {
    if (isWindows) {
        console.error(`❌ Certificado no encontrado en ${SSL_PFX_PATH}`);
        process.exit(1);
    } else {
        // En Linux, si no hay certificado, avisar pero intentar HTTP (o fallar si el usuario lo prefiere)
        console.warn(`⚠️ Certificado no encontrado en ${SSL_PFX_PATH}. Iniciando en HTTP (¡El micrófono podría no funcionar!)`);
        server = app.listen(PORT, '0.0.0.0');
    }
}

const wss = new WebSocketServer({ server });
console.log('WebSocket server listo');
console.log(`Documentos cargados dinámicamente al conectar clientes.`);

wss.on('connection', async (ws) => {
    console.log('Cliente conectado');

    // Generar instrucción del sistema fresca para esta conexión
    const currentSystemInstruction = generateSystemInstruction();

    // Obtener servicios del registro
    const iotService = getIoTService();
    const dataService = getDataService();

    // Crear handler de herramientas con todos los servicios inyectados
    const toolHandler = createToolHandler({
        whatsappService,
        iotService,
        dataService
    });

    // ===== ARQUITECTURA DE DOS MODELOS (STREAMING) =====
    // 1. audioService: gemini-2.5-flash-native-audio-preview (LIVE - STT/TTS)
    // 2. llmService: gemini-2.5-flash (request/response - lógica + tools)

    // --- Inicializar LLM Service (texto + tools) ---
    const llmService = LLMFactory.createLLM('gemini', {
        apiKey: process.env.GOOGLE_API_KEY,
        systemInstruction: currentSystemInstruction,
        toolHandler: toolHandler
    });

    // --- Inicializar Audio Service (STT/TTS STREAMING) ---
    const audioService = LLMFactory.createAudioService({
        apiKey: process.env.GOOGLE_API_KEY
    });

    let useFallbackTTS = ttsService.isConfigured();
    let isProcessingLLM = false;

    try {
        await llmService.initialize();
        console.log('LLM Service (gemini-2.0-flash) inicializado');
    } catch (error) {
        console.error("Error inicializando LLM:", error);
        ws.send(JSON.stringify({ type: 'error', message: 'Error inicializando IA' }));
        ws.close();
        return;
    }

    // Iniciar Chat Session
    const chatSession = await llmService.startChat();

    // --- Configurar callbacks del Audio Service ---

    // === DETECCIÓN DE COMANDOS ===
    // Función para detectar si el transcript es un comando que requiere tools
    const detectCommand = (text) => {
        const lowerText = text.toLowerCase();

        // Patrones de comandos IoT
        const iotPatterns = [
            /prende|enciende|activa/i,
            /apaga|desactiva/i,
            /showroom/i,
            /l[áa]mpara|luz/i
        ];

        // Patrones de comandos WhatsApp
        const whatsappPatterns = [
            /avisa|notifica|comunica|dile|avisale/i,
            /llama a|contacta a|manda mensaje/i,
            /lleg[óo].*paquete|encargo|encomienda/i,
            /busco a|busca a/i,
            /est[áa].*en recepci[óo]n/i,
            /visita.*para|lleg[óo].*visita/i
        ];

        const hasIoT = iotPatterns.some(p => p.test(lowerText));
        const hasWhatsApp = whatsappPatterns.some(p => p.test(lowerText));

        return hasIoT || hasWhatsApp;
    };

    // Callback: Cuando llega pensamiento del modelo (Hybrid Trigger)
    // DESACTIVADO POR REDUNDANCIA: Ya tenemos el STT del cliente que es más preciso.
    /*
    audioService.setThoughtCallback(async (thoughtText) => {
        console.log(`[THOUGHT] Recibido: "${thoughtText}"`);
        // ... (lógica deshabilitada) ...
    });
    */

    // Callback: Cuando llega transcripción (STT) - Mantenemos esto por si acaso llega STT real
    audioService.setTranscriptCallback(async (transcript) => {
        console.log(`[TRANSCRIPT] Recibido: "${transcript}"`);

        if (!transcript || transcript.trim() === '') {
            return;
        }

        console.log(`=== TRANSCRIPCIÓN: "${transcript}" ===`);

        // HÍBRIDO: Enviar al flash en PARALELO para detectar tools
        // El native-audio ya está respondiendo naturalmente
        // Si flash usa un tool, interrumpimos y enviamos esa respuesta

        // No bloquear - ejecutar en background
        (async () => {
            try {
                let toolWasUsed = false;

                const response = await llmService.sendMessage({
                    text: transcript,
                    chatSession: chatSession,
                    onToolAction: (toolName, result) => {
                        toolWasUsed = true;
                        console.log(`[TOOL] ${toolName} ejecutado - interrumpiendo native-audio`);

                        if (result && result.action === 'open_whatsapp' && result.whatsappUrl) {
                            ws.send(JSON.stringify({
                                type: 'whatsapp_notification',
                                url: result.whatsappUrl,
                                contactName: result.contactName || 'Contacto'
                            }));
                        }
                    }
                });

                // Solo enviar respuesta de flash si usó un tool
                // Si no usó tool, native-audio ya respondió naturalmente
                if (toolWasUsed && response.text) {
                    console.log(`[HYBRID] Tool usado, enviando respuesta flash a TTS: "${response.text}"`);
                    if (audioService.isReady()) {
                        audioService.sendTextForTTS(response.text);
                    } else {
                        ws.send(JSON.stringify({ type: 'text', text: response.text }));
                    }
                } else {
                    console.log(`[HYBRID] Sin tools, native-audio manejó la respuesta`);
                }

            } catch (error) {
                console.error('Error en verificación de tools:', error.message);
            }
        })();
    });

    // Callback: Cuando llega audio de TTS
    audioService.setAudioCallback((audioChunk) => {
        // Enviar chunk de audio al cliente
        ws.send(JSON.stringify({
            type: 'audio',
            data: audioChunk.toString('base64')
        }));
    });

    // Callback: Cuando hay error
    audioService.setErrorCallback((error) => {
        console.error('Audio Service error:', error);
    });

    // Callback: Cuando se interrumpe
    audioService.setInterruptedCallback(() => {
        ws.send(JSON.stringify({ type: 'interrupted' }));
    });

    // Callback: Cuando se desconecta (sesión cerrada por servidor)
    audioService.setCloseCallback(async () => {
        console.warn('⚠️ Audio Service desconectado por el servidor remoto.');
        // Solo intentar reconectar si el socket del cliente sigue abierto
        if (ws.readyState === ws.OPEN) {
            ws.send(JSON.stringify({ type: 'status', status: 'reconnecting', message: 'Reconectando servicio de voz...' }));

            // Intentar reconectar
            try {
                await audioService.connect(currentSystemInstruction);
                ws.send(JSON.stringify({ type: 'status', status: 'connected', message: 'Servicio de voz reconectado' }));
                console.log('✅ Audio Service reconectado exitosamente');
            } catch (e) {
                console.error('❌ Fallo al reconectar Audio Service:', e);
                ws.send(JSON.stringify({ type: 'error', message: 'La sesión de voz se perdió y no pudo recuperarse.' }));
            }
        }
    });

    // --- Intentar conectar Audio Service (LIVE session) ---
    try {
        await audioService.connect(currentSystemInstruction);
        console.log('Audio Service LIVE conectado con system instruction');
    } catch (error) {
        console.warn('Audio Service no disponible:', error.message);
    }

    // Notificar conexión al cliente
    ws.send(JSON.stringify({
        type: 'connected',
        voiceMode: audioService.isReady() ? 'native' : (useFallbackTTS ? 'elevenlabs' : 'none'),
        whatsappStatus: whatsappService ? whatsappService.getStatus() : null
    }));

    // --- Gestión de Audio del Mic ---
    function calculateRMS(buffer) {
        const int16Data = new Int16Array(buffer.buffer, buffer.byteOffset, buffer.length / 2);
        let sum = 0;
        for (let i = 0; i < int16Data.length; i++) {
            const sample = int16Data[i] / 32768.0;
            sum += sample * sample;
        }
        return Math.sqrt(sum / int16Data.length);
    }

    // Estado para tracking de audio (solo para logging)
    let isSpeaking = false;
    let silenceTimer = null;

    ws.on('message', async (data) => {
        try {
            const message = JSON.parse(data);

            if (message.type === 'audio') {
                const chunkBuffer = Buffer.from(message.data, 'base64');

                // ===== STREAMING EN TIEMPO REAL =====
                // Enviar TODOS los chunks inmediatamente al modelo
                // Incluyendo silencio - el VAD del modelo necesita el silencio
                // para detectar cuando el usuario termina de hablar
                if (audioService.isReady()) {
                    const sent = audioService.sendAudioChunk(chunkBuffer);
                    if (!sent) {
                        console.warn('[AUDIO] No se pudo enviar chunk: AudioService desconectado');
                    }
                }

                // Logging opcional (solo para debug)
                const rms = calculateRMS(chunkBuffer);
                if (rms > 0.01 && !isSpeaking) {
                    isSpeaking = true;
                    console.log('[AUDIO] Usuario comenzó a hablar');
                } else if (rms <= 0.01 && isSpeaking) {
                    isSpeaking = false;
                    console.log('[AUDIO] Usuario dejó de hablar');
                }

            } else if (message.type === 'client_transcript') {
                // Nuevo handling para STT del cliente (Hybrid Tool Trigger)
                const transcript = message.text;
                console.log(`[CLIENT-TRANSCRIPT] Recibido de Web Speech API: "${transcript}"`);

                if (!transcript || transcript.trim() === '') return;

                // Enviar al modelo Flash para detectar tools
                // No esperamos respuesta de audio, solo ejecución de tools
                (async () => {
                    try {
                        let toolWasUsed = false;

                        // Contexto explícito para el modelo de tools
                        const toolInput = `El usuario dijo: "${transcript}". Si es un comando (luces, whatsapp, etc), ejecútalo. Si es charla normal, IGNORA.`;

                        const response = await llmService.sendMessage({
                            text: toolInput,
                            chatSession: chatSession, // Mantener contexto
                            onToolAction: (toolName, result) => {
                                toolWasUsed = true;
                                console.log(`[TOOL-HYBRID] ${toolName} ejecutado (origen: Client STT)`);

                                if (result && result.action === 'open_whatsapp' && result.whatsappUrl) {
                                    // MODIFICACIÓN: SUPRIMIR POPUP
                                    // Originalmente enviábamos 'whatsapp_notification' que abría window.open
                                    // Ahora solo logueamos que se generó la URL, pero no la abrimos en el cliente
                                    console.log(`[HYBRID] Popup suprimido. URL generada: ${result.whatsappUrl}`);
                                    /*
                                    ws.send(JSON.stringify({
                                        type: 'whatsapp_notification',
                                        url: result.whatsappUrl,
                                        contactName: result.contactName || 'Contacto'
                                    }));
                                    */
                                }
                            }
                        });

                        if (toolWasUsed) {
                            console.log('[HYBRID] Tool ejecutado exitosamente via Client STT');
                            // Opcional: Feedback verbal si es crítico
                        }

                    } catch (error) {
                        console.error('Error procesando Client Transcript:', error);
                    }
                })();

            } else if (message.type === 'text') {
                // Entrada de texto directo (debug/chat)
                console.log('Recibido texto:', message.text);

                const response = await llmService.sendMessage({
                    text: message.text,
                    chatSession: chatSession,
                    onToolAction: (toolName, result) => {
                        if (result && result.action === 'open_whatsapp' && result.whatsappUrl) {
                            ws.send(JSON.stringify({
                                type: 'whatsapp_notification',
                                url: result.whatsappUrl,
                                contactName: result.contactName || 'Contacto'
                            }));
                        }
                    }
                });

                ws.send(JSON.stringify({ type: 'text', text: response.text }));

                // TTS
                if (response.text) {
                    if (audioService.isReady()) {
                        audioService.sendTextForTTS(response.text);
                    } else if (useFallbackTTS) {
                        try {
                            const audioBuffer = await ttsService.textToSpeech(response.text);
                            ws.send(JSON.stringify({
                                type: 'elevenlabs_audio',
                                data: audioBuffer.toString('base64')
                            }));
                        } catch (e) {
                            console.error('TTS Error:', e);
                        }
                    }
                }
            } else if (message.type === 'whatsapp_send' && whatsappService) {
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

        // Desconectar audio service
        if (audioService.isReady()) {
            audioService.disconnect();
        }
    });
});
