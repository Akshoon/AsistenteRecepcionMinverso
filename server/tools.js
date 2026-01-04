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

// Factory para crear el handler con dependencias (como WhatsAppService)
export function createToolHandler(dependencies = {}) {
    const { whatsappService } = dependencies;

    return async function handleToolCall(functionCall) {
        const { name, args } = functionCall;

        console.log(`[ToolHandler] Ejecutando tool: ${name}`);

        if (name === "visit_url") {
            console.log(`Ejecutando tool: visit_url con URL: ${args.url}`);
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

            // Buscar contacto (case insensitive)
            const contactKey = Object.keys(phoneNumbers).find(
                key => key.toLowerCase() === args.contactName.toLowerCase()
            );

            if (!contactKey) {
                console.error(`Contacto no encontrado: ${args.contactName}`);
                return {
                    error: `Lo siento, no tengo registro de ${args.contactName} en mi lista de contactos.`
                };
            }

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
                        return {
                            result: `Mensaje enviado correctamente a ${args.contactName}.`
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
                phoneNumber: phoneNumber, // Added phone number
                message: args.message,    // Added message
                action: "open_whatsapp"
            };
        }

        return { error: `Herramienta desconocida: ${name}` };
    }
}

// Mantener compatibilidad hacia atrás (legacy simple handler)
export const handleToolCall = createToolHandler({});
