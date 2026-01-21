import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * WhatsAppService - Automatiza el envío de mensajes a través de WhatsApp Web usando Puppeteer
 */
export class WhatsAppService {
    constructor(options = {}) {
        this.sessionPath = options.sessionPath || path.join(__dirname, '../../data/whatsapp-session');
        this.headless = options.headless !== false; // Default true
        this.browser = null;
        this.page = null;
        this.isAuthenticated = false;
        this.isInitializing = false;

        // Asegurar que existe el directorio de sesión
        if (!fs.existsSync(this.sessionPath)) {
            fs.mkdirSync(this.sessionPath, { recursive: true });
        }
    }

    /**
     * Inicializa el navegador y carga WhatsApp Web
     */
    async initialize() {
        if (this.isInitializing) {
            throw new Error('WhatsApp service is already initializing');
        }

        if (this.browser) {
            console.log('WhatsApp service already initialized');
            return;
        }

        this.isInitializing = true;

        try {
            console.log('Iniciando navegador para WhatsApp Web...');

            // Lanzar navegador con sesión persistente
            this.browser = await puppeteer.launch({
                executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
                headless: this.headless,
                userDataDir: this.sessionPath,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--no-first-run',
                    '--no-zygote',
                    '--disable-gpu',
                    '--use-fake-ui-for-media-stream' // Bypass mic permission prompt
                ]
            });

            this.page = await this.browser.newPage();

            // Configurar viewport
            await this.page.setViewport({ width: 1280, height: 720 });

            // Configurar viewport
            await this.page.setViewport({ width: 1280, height: 720 });

            // Configurar user agent
            await this.page.setUserAgent(
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            );

            console.log('Navegando a WhatsApp Web...');
            await this.page.goto('https://web.whatsapp.com', {
                waitUntil: 'networkidle2',
                timeout: 60000
            });

            console.log('WhatsApp Web cargado, esperando autenticación...');

        } catch (error) {
            console.error('Error inicializando WhatsApp service:', error);
            this.isInitializing = false;
            throw error;
        }

        this.isInitializing = false;
    }

    /**
     * Realiza una llamada de voz y corta después de X ms
     * @param {string} phoneNumber - Número a llamar
     * @param {number} durationMs - Duración en ms antes de cortar (default 6000ms ~ 2 tonos)
     */
    async makeCall(phoneNumber, durationMs = 6000) {
        if (!this.isAuthenticated) {
            console.warn('[WhatsAppService] Cannot call: Not authenticated');
            return false;
        }

        try {
            console.log(`[WhatsAppService] Iniciando llamada a ${phoneNumber} por ${durationMs}ms`);

            // 1. Ir al chat (si ya estamos ahí por el mensaje, esto es rápido)
            const cleanPhone = phoneNumber.replace(/[^\d+]/g, '');
            const url = `https://web.whatsapp.com/send?phone=${cleanPhone}`;

            // Solo navegar si no estamos ya en la URL correcta
            if (!this.page.url().includes(cleanPhone)) {
                await this.page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
                await this.page.waitForSelector('#side', { timeout: 15000 });
                await new Promise(r => setTimeout(r, 2000));
            }

            // 2. Buscar botón de llamada de voz
            // Selectores posibles para el botón de llamada
            const callBtnSelectors = [
                'div[title="Llamada de voz"]',
                'div[aria-label="Llamada de voz"]',
                'span[data-icon="audio-call"]',
                'div[role="button"][title="Llamada de voz"]'
            ];

            let callBtn = null;
            for (const sel of callBtnSelectors) {
                callBtn = await this.page.$(sel);
                if (callBtn) break;
            }

            if (!callBtn) {
                console.warn('[WhatsAppService] No se encontró botón de llamada');
                return false;
            }

            // 3. Click en llamar
            await callBtn.click();
            console.log('[WhatsAppService] Llamada iniciada...');

            // 4. Esperar duración (timbrazo)
            await new Promise(r => setTimeout(r, durationMs));

            // 5. Cortar llamada
            const endCallSelectors = [
                'div[aria-label="Finalizar llamada"]',
                'div[title="Finalizar llamada"]',
                'span[data-icon="call-end"]',
                'span[data-icon="end-call"]'
            ];

            let endBtn = null;
            for (const sel of endCallSelectors) {
                endBtn = await this.page.$(sel);
                if (endBtn) break;
            }

            if (endBtn) {
                await endBtn.click();
                console.log('[WhatsAppService] Llamada finalizada (Timbrazo completo)');
                return true;
            } else {
                console.warn('[WhatsAppService] No se encontró botón para colgar, intentando cerrar diálogo');
                // Fallback: cerrar modal si existe
                return false;
            }

        } catch (error) {
            console.error('[WhatsAppService] Error en makeCall:', error);
            return false;
        }
    }

    /**
     * Espera a que el usuario escanee el código QR o que se restaure la sesión
     * @returns {Promise<boolean>} true si autenticado
     */
    async waitForAuth(timeout = 120000) {
        if (!this.page) {
            throw new Error('Browser not initialized. Call initialize() first.');
        }

        try {
            console.log('Esperando autenticación...');

            // Selectores para QR (Inglés y Español) y Canvas genérico
            const qrSelector = 'canvas[aria-label*="Scan"], canvas[aria-label*="scan"], canvas[aria-label*="Escanea"], canvas[aria-label*="Código"], canvas';

            await Promise.race([
                this.page.waitForSelector('#side', { timeout }),
                this.page.waitForSelector(qrSelector, { timeout })
            ]);

            // Verificar si está autenticado buscando el panel lateral de chats
            const isAuth = await this.page.$('#side');

            if (isAuth) {
                console.log('✓ WhatsApp autenticado correctamente');
                this.isAuthenticated = true;
                return true;
            }

            console.log('QR Code presente (detectado visualmente), esperando escaneo...');
            return false;

        } catch (error) {
            console.error('Error esperando autenticación (posible timeout):', error.message);
            return false;
        }
    }

    /**
     * Obtiene el código QR como imagen base64
     * @returns {Promise<string|null>} Base64 del QR o null si no hay QR
     */
    async getQRCode() {
        if (!this.page) {
            throw new Error('Browser not initialized');
        }

        console.log('Buscando elemento QR en la página...');

        try {
            // Intentar buscar con selectores específicos primero (más seguros)
            // Incluye variaciones de idioma
            const selectors = [
                'canvas[aria-label*="Scan"]',
                'canvas[aria-label*="scan"]',
                'canvas[aria-label*="Escanea"]',
                'canvas[aria-label*="Código"]'
            ];

            let qrElement = null;

            for (const sel of selectors) {
                const el = await this.page.$(sel);
                if (el) {
                    console.log(`QR encontrado con selector específico: ${sel}`);
                    qrElement = el;
                    break;
                }
            }

            // Fallback: buscar cualquier canvas si el específico falla
            if (!qrElement) {
                console.log('Selector específico no encontrado, intentando fallback a canvas genérico...');
                qrElement = await this.page.$('canvas');
                if (qrElement) console.log('QR (o canvas) encontrado con selector genérico');
            }

            if (!qrElement) {
                console.log('No se encontró ningún elemento QR code (posiblemente ya autenticado o cargando)');
                // Debug: listar todos los aria-labels de canvases para ver qué hay
                const canvasLabels = await this.page.$$eval('canvas', els => els.map(e => e.getAttribute('aria-label')));
                console.log('Canvas visibles en página:', canvasLabels);
                return null;
            }

            // Capturar como imagen
            const qrImage = await qrElement.screenshot({ encoding: 'base64' });
            console.log('QR capturado exitosamente');
            return qrImage;

        } catch (error) {
            console.error('Error obteniendo QR code:', error);
            return null;
        }
    }

    /**
     * Verifica si WhatsApp está listo para enviar mensajes
     * @returns {Promise<boolean>}
     */
    async isReady() {
        if (!this.page || !this.browser) {
            return false;
        }

        try {
            // Verificar que el panel lateral de chats esté presente
            const panel = await this.page.$('#side');
            this.isAuthenticated = !!panel;
            return this.isAuthenticated;
        } catch (error) {
            return false;
        }
    }

    /**
     * Envía un mensaje de WhatsApp a un número específico
     * @param {string} phoneNumber - Número con código de país (ej: +56912345678)
     * @param {string} message - Mensaje a enviar
     * @returns {Promise<boolean>} true si se envió correctamente
     */
    async sendMessage(phoneNumber, message) {
        if (!this.isAuthenticated) {
            throw new Error('WhatsApp not authenticated. Scan QR code first.');
        }

        if (!phoneNumber || !message) {
            throw new Error('Phone number and message are required');
        }

        try {
            console.log(`Enviando mensaje a ${phoneNumber}: "${message}"`);

            // Limpiar número de teléfono (remover espacios, guiones, etc.)
            const cleanPhone = phoneNumber.replace(/[^\d+]/g, '');

            // URL directa para enviar mensaje
            const url = `https://web.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(message)}`;

            await this.page.goto(url, {
                waitUntil: 'networkidle2',
                timeout: 30000
            });

            // Esperar a que cargue el chat (panel lateral)
            await this.page.waitForSelector('#side', {
                timeout: 15000
            });

            // Esperar un poco más para que cargue completamente
            await new Promise(r => setTimeout(r, 2000));

            // Buscar el botón de enviar y hacer click
            const sendButton = await this.page.$('button[data-testid="compose-btn-send"]');

            if (!sendButton) {
                console.warn('No se encontró el botón de enviar, intentando con Enter...');
                // Alternativa: presionar Enter en el campo de texto
                await this.page.keyboard.press('Enter');
            } else {
                await sendButton.click();
            }

            console.log('✓ Mensaje enviado correctamente');

            // Esperar un poco para confirmar envío
            await new Promise(r => setTimeout(r, 1000));

            return true;

        } catch (error) {
            console.error('Error enviando mensaje:', error);
            throw new Error(`Failed to send message: ${error.message}`);
        }
    }

    /**
     * Cierra el navegador y limpia recursos
     */
    async close() {
        if (this.browser) {
            console.log('Cerrando navegador de WhatsApp...');
            await this.browser.close();
            this.browser = null;
            this.page = null;
            this.isAuthenticated = false;
        }
    }

    /**
     * Obtiene el estado actual del servicio
     */
    getStatus() {
        return {
            initialized: !!this.browser,
            authenticated: this.isAuthenticated,
            ready: this.isAuthenticated && !!this.page
        };
    }
}
