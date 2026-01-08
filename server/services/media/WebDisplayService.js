/**
 * WebDisplayService - Servicio de exhibición de sitios web
 * 
 * PLACEHOLDER: Este servicio está preparado para implementar:
 * - Mostrar sitios web en pantalla
 * - Navegación automática
 * - Modos de presentación
 * 
 * @future Integrar con frontend para iframe/webview
 */
import { BaseService } from '../base/BaseService.js';

export class WebDisplayService extends BaseService {
    constructor(options = {}) {
        super('WebDisplayService', options);

        this.currentUrl = null;
        this.allowedDomains = options.allowedDomains || [];
    }

    async initialize() {
        await super.initialize();

        if (!this.enabled) return false;

        this.log('Servicio de web display preparado');
        this._isReady = true;
        return true;
    }

    /**
     * Muestra un sitio web en pantalla
     * @param {string} url - URL del sitio
     * @param {object} options - Opciones (fullscreen, duration, etc.)
     * @returns {Promise<object>}
     */
    async showWebsite(url, options = {}) {
        if (!this._isReady) {
            return { error: 'Servicio de web display no disponible' };
        }

        this.currentUrl = url;
        this.log(`Mostrando sitio web: ${url}`);

        // TODO: Enviar comando al frontend vía WebSocket
        return {
            action: 'show_website',
            url,
            options
        };
    }

    /**
     * Navega a una URL dentro del webview actual
     * @param {string} url - Nueva URL
     * @returns {Promise<object>}
     */
    async navigateTo(url) {
        if (!this._isReady) {
            return { error: 'Servicio de web display no disponible' };
        }

        this.currentUrl = url;

        // TODO: Enviar comando al frontend
        return {
            action: 'navigate_to',
            url
        };
    }

    /**
     * Cierra el sitio web actual
     * @returns {Promise<object>}
     */
    async closeWebsite() {
        if (!this._isReady) {
            return { error: 'Servicio de web display no disponible' };
        }

        const previousUrl = this.currentUrl;
        this.currentUrl = null;

        this.log('Sitio web cerrado');

        // TODO: Enviar comando al frontend
        return {
            action: 'close_website',
            previousUrl
        };
    }

    /**
     * Obtiene el estado actual
     * @returns {object}
     */
    getCurrentStatus() {
        return {
            currentUrl: this.currentUrl,
            isShowing: this.currentUrl !== null
        };
    }
}

export default WebDisplayService;
