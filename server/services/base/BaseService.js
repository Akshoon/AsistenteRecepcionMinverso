/**
 * BaseService - Clase base abstracta para todos los servicios
 * 
 * Todas las integraciones futuras deben heredar de esta clase
 * para mantener consistencia en la interfaz y ciclo de vida.
 */
export class BaseService {
    constructor(name, options = {}) {
        this.name = name;
        this.options = options;
        this._isInitialized = false;
        this._isReady = false;
        this.enabled = options.enabled ?? true;
    }

    /**
     * Inicializa el servicio. Debe ser implementado por subclases.
     * @returns {Promise<boolean>}
     */
    async initialize() {
        if (!this.enabled) {
            console.log(`[${this.name}] Servicio deshabilitado, saltando inicialización`);
            return false;
        }
        console.log(`[${this.name}] Inicializando...`);
        this._isInitialized = true;
        return true;
    }

    /**
     * Verifica si el servicio está listo para usar
     * @returns {Promise<boolean>}
     */
    async isReady() {
        return this._isReady && this.enabled;
    }

    /**
     * Apaga el servicio de forma segura
     * @returns {Promise<void>}
     */
    async shutdown() {
        console.log(`[${this.name}] Apagando servicio...`);
        this._isReady = false;
        this._isInitialized = false;
    }

    /**
     * Obtiene el estado actual del servicio
     * @returns {object}
     */
    getStatus() {
        return {
            name: this.name,
            enabled: this.enabled,
            isInitialized: this._isInitialized,
            isReady: this._isReady
        };
    }

    /**
     * Método helper para log con prefijo del servicio
     */
    log(message, level = 'info') {
        const prefix = `[${this.name}]`;
        if (level === 'error') {
            console.error(prefix, message);
        } else if (level === 'warn') {
            console.warn(prefix, message);
        } else {
            console.log(prefix, message);
        }
    }
}

export default BaseService;
