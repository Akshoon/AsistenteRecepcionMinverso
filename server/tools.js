// Definición de las herramientas que puede usar el modelo
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Cargar contactos de WhatsApp
function loadPhoneNumbers() {
    try {
        const phonePath = join(__dirname, 'data', 'extras', 'phone_number.json');
        console.log(`[Tools] Cargando contactos desde: ${phonePath}`);
        if (fs.existsSync(phonePath)) {
            const data = fs.readFileSync(phonePath, 'utf-8');
            const contacts = JSON.parse(data);
            console.log(`[Tools] Contactos cargados:`, Object.keys(contacts));
            return contacts;
        } else {
            console.warn(`[Tools] Archivo de contactos no existe en: ${phonePath}`);
        }
    } catch (error) {
        console.error('Error cargando phone_number.json:', error);
    }
    return {};
}

export const tools = [
    {
        functionDeclarations: [
            {
                name: "visit_url",
                description: "Visita una URL específica para realizar una acción en el showroom o sistema IoT via HTTP GET.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        url: {
                            type: "STRING",
                            description: "La URL completa a visitar, incluyendo http/https."
                        }
                    },
                    required: ["url"]
                }
            },
            {
                name: "notify_whatsapp",
                description: "Envía una notificación por WhatsApp a un contacto registrado. Retorna una URL que el frontend abrirá para enviar el mensaje.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        contactName: {
                            type: "STRING",
                            description: "El nombre del contacto a notificar (ej: 'Diego', 'Juan'). Debe coincidir exactamente con un nombre en la lista de contactos."
                        },
                        message: {
                            type: "STRING",
                            description: "El mensaje a enviar por WhatsApp."
                        }
                    },
                    required: ["contactName", "message"]
                }
            }
        ]
    }
];

// ===============================================
// FUTURE TOOLS - Preparados para integraciones futuras
// Descomentar y agregar a 'tools' cuando se implementen
// ===============================================

export const futureToolDeclarations = {
    // Calendar Integration
    calendar_check: {
        name: "calendar_check",
        description: "Consulta el calendario del equipo para ver disponibilidad o eventos.",
        parameters: {
            type: "OBJECT",
            properties: {
                personName: { type: "STRING", description: "Nombre de la persona a consultar" },
                date: { type: "STRING", description: "Fecha a consultar (formato YYYY-MM-DD)" }
            },
            required: ["personName"]
        },
        enabled: false
    },

    // WhatsApp Call
    whatsapp_call: {
        name: "whatsapp_call",
        description: "Inicia una llamada de WhatsApp a un contacto.",
        parameters: {
            type: "OBJECT",
            properties: {
                contactName: { type: "STRING", description: "Nombre del contacto a llamar" }
            },
            required: ["contactName"]
        },
        enabled: false
    },

    // Media Display
    display_media: {
        name: "display_media",
        description: "Muestra una imagen o reproduce un video en pantalla.",
        parameters: {
            type: "OBJECT",
            properties: {
                mediaType: { type: "STRING", description: "Tipo de media: 'image' o 'video'" },
                mediaPath: { type: "STRING", description: "Ruta o URL del archivo multimedia" }
            },
            required: ["mediaType", "mediaPath"]
        },
        enabled: false
    },

    // Website Display
    display_website: {
        name: "display_website",
        description: "Muestra un sitio web en pantalla.",
        parameters: {
            type: "OBJECT",
            properties: {
                url: { type: "STRING", description: "URL del sitio web a mostrar" }
            },
            required: ["url"]
        },
        enabled: false
    },

    // Avatar Gesture
    avatar_gesture: {
        name: "avatar_gesture",
        description: "Ejecuta un gesto o movimiento del avatar.",
        parameters: {
            type: "OBJECT",
            properties: {
                gesture: { type: "STRING", description: "Nombre del gesto: 'wave', 'nod', 'shake_head', 'thinking', 'pointing', 'greeting', 'farewell'" }
            },
            required: ["gesture"]
        },
        enabled: false
    },

    // Door Control
    door_control: {
        name: "door_control",
        description: "Controla una puerta (abrir/cerrar).",
        parameters: {
            type: "OBJECT",
            properties: {
                action: { type: "STRING", description: "Acción: 'open' o 'close'" },
                doorId: { type: "STRING", description: "ID de la puerta (opcional, default: 'main')" }
            },
            required: ["action"]
        },
        enabled: false
    },

    // Music Control
    music_control: {
        name: "music_control",
        description: "Controla la reproducción de música.",
        parameters: {
            type: "OBJECT",
            properties: {
                action: { type: "STRING", description: "Acción: 'play', 'stop', 'pause', 'volume'" },
                value: { type: "STRING", description: "Valor opcional (ej: nivel de volumen 0-100)" }
            },
            required: ["action"]
        },
        enabled: false
    },

    // Person Recognition
    identify_person: {
        name: "identify_person",
        description: "Intenta identificar a una persona por reconocimiento facial.",
        parameters: {
            type: "OBJECT",
            properties: {
                cameraId: { type: "STRING", description: "ID de la cámara a usar (opcional)" }
            },
            required: []
        },
        enabled: false
    }
};

// ===============================================
// Dynamic Tool Registration System
// ===============================================

/**
 * Registra una nueva herramienta dinámicamente
 * @param {object} toolDeclaration - Declaración de la herramienta
 * @returns {boolean} - true si se registró correctamente
 */
export function registerTool(toolDeclaration) {
    if (!toolDeclaration.name || !toolDeclaration.parameters) {
        console.error('[Tools] Declaración de herramienta inválida');
        return false;
    }

    // Buscar el array de functionDeclarations
    const declarations = tools[0].functionDeclarations;

    // Verificar si ya existe
    const existingIndex = declarations.findIndex(t => t.name === toolDeclaration.name);
    if (existingIndex >= 0) {
        console.warn(`[Tools] Herramienta "${toolDeclaration.name}" ya existe, actualizando...`);
        declarations[existingIndex] = toolDeclaration;
    } else {
        declarations.push(toolDeclaration);
        console.log(`[Tools] Herramienta "${toolDeclaration.name}" registrada`);
    }

    return true;
}

/**
 * Habilita una herramienta futura
 * @param {string} toolName - Nombre de la herramienta
 * @returns {boolean}
 */
export function enableFutureTool(toolName) {
    const futureTool = futureToolDeclarations[toolName];
    if (!futureTool) {
        console.error(`[Tools] Herramienta futura "${toolName}" no encontrada`);
        return false;
    }

    futureTool.enabled = true;
    return registerTool(futureTool);
}

/**
 * Obtiene la lista de todas las herramientas (activas y futuras)
 * @returns {object}
 */
export function getToolsInfo() {
    const active = tools[0].functionDeclarations.map(t => t.name);
    const future = Object.entries(futureToolDeclarations).map(([key, tool]) => ({
        name: key,
        enabled: tool.enabled
    }));

    return { active, future };
}


// Factory para crear el handler con dependencias (WhatsAppService, IoTService, etc.)
export function createToolHandler(dependencies = {}) {
    const { whatsappService, iotService, dataService } = dependencies;

    return async function handleToolCall(functionCall) {
        const { name, args } = functionCall;

        console.log(`[ToolHandler] Ejecutando tool: ${name}`);

        // Log interaction if data service available
        if (dataService) {
            dataService.logInteraction({
                type: 'tool_call',
                toolName: name,
                args: args
            });
        }

        if (name === "visit_url") {
            console.log(`Ejecutando tool: visit_url con URL: ${args.url}`);

            // Si tenemos iotService, intentar usar el dispositivo correspondiente
            if (iotService) {
                // Detectar si es una URL de dispositivo IoT conocido
                const url = args.url.toLowerCase();
                let deviceMatch = null;
                let action = null;

                // Detectar showroom
                if (url.includes('showroom') || url.includes('lampara')) {
                    if (url.includes('action=on')) action = 'on';
                    else if (url.includes('action=off')) action = 'off';

                    // Extraer dispositivo
                    if (url.includes('showroom')) deviceMatch = 'showroom';
                    else if (url.includes('lampara3')) deviceMatch = 'lampara3';
                    else if (url.includes('lampara2')) deviceMatch = 'lampara2';
                    else if (url.includes('lampara')) deviceMatch = 'lampara1';
                }

                if (deviceMatch && action) {
                    console.log(`[ToolHandler] Detectado dispositivo IoT: ${deviceMatch} -> ${action}`);
                    const result = await iotService.executeAction(deviceMatch, action);
                    if (result.success) {
                        return {
                            result: `${deviceMatch} ${action === 'on' ? 'encendido' : 'apagado'} correctamente.`
                        };
                    }
                    // Si falla el servicio, continuar con HTTP directo
                }
            }

            // Detectar si es un comando de GRUPO
            // Cargar instrucciones para ver si hay grupos
            try {
                const instructionsPath = join(__dirname, 'data/extras/instrucciones.json');
                if (fs.existsSync(instructionsPath)) {
                    const instructions = JSON.parse(fs.readFileSync(instructionsPath, 'utf-8'));
                    const commands = instructions.comandos?.commands || [];

                    // Buscar comando que coincida con esta URL
                    const matchingCmd = commands.find(cmd => cmd.args?.url === args.url);

                    if (matchingCmd && matchingCmd.isGroup && matchingCmd.groupDevices?.length > 0) {
                        console.log(`[ToolHandler] Detectado GRUPO: ${matchingCmd.id} con ${matchingCmd.groupDevices.length} dispositivos`);

                        const action = matchingCmd.id.endsWith('_on') ? 'on' : 'off';
                        const results = [];

                        // Ejecutar cada dispositivo del grupo
                        for (const deviceId of matchingCmd.groupDevices) {
                            const deviceCmd = commands.find(c => c.id === `${deviceId}_${action}`);
                            if (deviceCmd?.args?.url) {
                                try {
                                    console.log(`[ToolHandler] Ejecutando ${deviceId}: ${deviceCmd.args.url}`);
                                    await fetch(deviceCmd.args.url);
                                    results.push(`${deviceId}: OK`);
                                } catch (e) {
                                    results.push(`${deviceId}: Error`);
                                }
                            }
                        }

                        return {
                            result: `Grupo ${matchingCmd.id.replace('grupo_', '').replace('_on', '').replace('_off', '')} ${action === 'on' ? 'encendido' : 'apagado'}. Dispositivos: ${results.join(', ')}`
                        };
                    }
                }
            } catch (e) {
                console.error('[ToolHandler] Error procesando grupo:', e.message);
            }

            // HTTP directo (comportamiento original)
            try {
                const response = await fetch(args.url, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                        'Accept': '*/*'
                    }
                });
                const text = await response.text();
                console.log(`Respuesta de URL: ${response.status} ${response.statusText}`);

                return {
                    result: `URL visitada con éxito. Código: ${response.status}. Respuesta: ${text.substring(0, 100)}`
                };
            } catch (error) {
                console.error(`Error visitando URL: ${error.message}`);
                return {
                    error: `Error al visitar la URL: ${error.message}`
                };
            }
        }

        if (name === "notify_whatsapp") {
            const phoneNumbers = loadPhoneNumbers();
            const searchName = args.contactName.toLowerCase().trim();
            const allContacts = Object.keys(phoneNumbers);

            console.log(`[Tools] Buscando contacto: "${args.contactName}" (normalizado: "${searchName}")`);
            console.log(`[Tools] Contactos disponibles:`, allContacts);

            let contactKey = null;
            let matchType = 'none';

            // 1. Buscar coincidencia EXACTA (case insensitive)
            contactKey = allContacts.find(key => key.toLowerCase() === searchName);
            if (contactKey) {
                matchType = 'exact';
                console.log(`[Tools] Match exacto encontrado: ${contactKey}`);
            }

            // 2. Si no hay exacta, buscar nombres que CONTENGAN el texto buscado
            if (!contactKey) {
                const partialMatches = allContacts.filter(
                    key => key.toLowerCase().includes(searchName) ||
                        searchName.includes(key.toLowerCase())
                );
                console.log(`[Tools] Matches parciales:`, partialMatches);

                if (partialMatches.length === 1) {
                    contactKey = partialMatches[0];
                    matchType = 'partial';
                    console.log(`[Tools] Match parcial único: ${contactKey}`);
                } else if (partialMatches.length > 1) {
                    const options = partialMatches.join(', ');
                    return {
                        error: `Encontré varias personas: ${options}. ¿A cuál quieres notificar?`
                    };
                }
            }

            // 3. Búsqueda por primer nombre
            if (!contactKey) {
                const firstNameMatches = allContacts.filter(key => {
                    const firstName = key.split(' ')[0].toLowerCase();
                    return firstName === searchName;
                });
                console.log(`[Tools] Matches por primer nombre:`, firstNameMatches);

                if (firstNameMatches.length === 1) {
                    contactKey = firstNameMatches[0];
                    matchType = 'firstName';
                    console.log(`[Tools] Match por primer nombre: ${contactKey}`);
                } else if (firstNameMatches.length > 1) {
                    const options = firstNameMatches.join(', ');
                    return {
                        error: `Hay varias personas llamadas ${args.contactName}: ${options}. ¿A cuál le notificamos?`
                    };
                }
            }

            // 4. No encontrado
            if (!contactKey) {
                console.error(`[Tools] Contacto NO encontrado: ${args.contactName}`);
                return {
                    error: `No encontré a "${args.contactName}". Contactos disponibles: ${allContacts.join(', ')}`
                };
            }

            console.log(`[Tools] Contacto final seleccionado: ${contactKey} (tipo: ${matchType})`);
            const phoneNumber = phoneNumbers[contactKey];

            // INTENTO DE ENVÍO SERVER-SIDE (si existe el servicio)
            console.log(`[ToolHandler] Estado whatsappService:`, whatsappService ? 'Disponible' : 'NO Disponible');

            if (whatsappService) {
                console.log(`[ToolHandler] Usando whatsappService para enviar a ${contactKey} (${phoneNumber})`);
                try {
                    const isReady = await whatsappService.isReady();
                    console.log(`[ToolHandler] WhatsApp Service Ready Status:`, isReady);

                    if (!isReady) {
                        console.warn("[ToolHandler] Servicio WhatsApp no listo. Fallback a cliente.");
                        // NO retornar error, dejar pasar al fallback
                    } else {
                        await whatsappService.sendMessage(phoneNumber, args.message);

                        // TIMBRAZO (Nudge) - 2 Tonos (~6 segundos)
                        try {
                            console.log(`[ToolHandler] Iniciando timbrazo a ${phoneNumber}...`);
                            await whatsappService.makeCall(phoneNumber, 6000);
                        } catch (callError) {
                            console.warn('[ToolHandler] Falló el timbrazo (no crítico):', callError);
                        }

                        // Indicar claramente a quién se le notificó
                        const notifiedName = contactKey !== args.contactName
                            ? `${contactKey} (encontrado como "${args.contactName}")`
                            : contactKey;
                        return {
                            result: `Notificando a ${notifiedName}. Mensaje enviado y timbrazo realizado.`
                        };
                    }
                } catch (error) {
                    console.error("Error enviando WhatsApp server-side:", error);
                    return {
                        error: `Error al enviar mensaje: ${error.message}`
                    };
                }
            }

            // FALLBACK: Retorno URL para cliente (si no hay servicio server-side)
            const whatsappUrl = `https://web.whatsapp.com/send?phone=${phoneNumber}&text=${encodeURIComponent(args.message)}`;

            console.log(`URL de WhatsApp generada para ${contactKey}: ${phoneNumber}`);

            return {
                result: "Notificación preparada para apertura en cliente",
                whatsappUrl: whatsappUrl,
                contactName: contactKey,
                phoneNumber: phoneNumber,
                message: args.message,
                action: "open_whatsapp"
            };
        }

        return { error: `Herramienta desconocida: ${name}` };
    }
}

// Mantener compatibilidad hacia atrás (legacy simple handler)
export const handleToolCall = createToolHandler({});
