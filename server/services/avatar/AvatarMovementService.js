/**
 * AvatarMovementService - Servicio de movimientos del avatar
 * 
 * PLACEHOLDER: Este servicio está preparado para implementar:
 * - Movimientos corporales
 * - Estados de pausa/idle
 * - Gestos y animaciones
 * 
 * @future Integrar con el Avatar3D del frontend
 */
import { BaseService } from '../base/BaseService.js';

export class AvatarMovementService extends BaseService {
    constructor(options = {}) {
        super('AvatarMovementService', options);

        this.currentState = 'idle';
        this.availableGestures = [
            'wave',
            'nod',
            'shake_head',
            'thinking',
            'pointing',
            'greeting',
            'farewell'
        ];
    }

    async initialize() {
        await super.initialize();

        if (!this.enabled) return false;

        this.log('Servicio de movimientos del avatar preparado');
        this._isReady = true;
        return true;
    }

    /**
     * Establece el estado idle del avatar
     * @param {string} mode - Modo idle ('relaxed', 'attentive', 'sleeping')
     * @returns {Promise<object>}
     */
    async setIdleState(mode = 'relaxed') {
        if (!this._isReady) {
            return { error: 'Servicio de avatar no disponible' };
        }

        this.currentState = `idle_${mode}`;
        this.log(`Estado idle: ${mode}`);

        // TODO: Enviar comando al frontend vía WebSocket
        return {
            action: 'set_idle',
            mode,
            state: this.currentState
        };
    }

    /**
     * Dispara un gesto específico
     * @param {string} gestureName - Nombre del gesto
     * @param {object} options - Opciones (intensity, duration, etc.)
     * @returns {Promise<object>}
     */
    async triggerGesture(gestureName, options = {}) {
        if (!this._isReady) {
            return { error: 'Servicio de avatar no disponible' };
        }

        if (!this.availableGestures.includes(gestureName)) {
            return { error: `Gesto desconocido: ${gestureName}` };
        }

        this.log(`Gesto: ${gestureName}`);

        // TODO: Enviar comando al frontend vía WebSocket
        return {
            action: 'trigger_gesture',
            gesture: gestureName,
            options
        };
    }

    /**
     * Establece el modo de movimiento general
     * @param {string} mode - Modo ('active', 'passive', 'paused')
     * @returns {Promise<object>}
     */
    async setMovementMode(mode) {
        if (!this._isReady) {
            return { error: 'Servicio de avatar no disponible' };
        }

        this.currentState = mode;
        this.log(`Modo de movimiento: ${mode}`);

        // TODO: Enviar comando al frontend
        return {
            action: 'set_movement_mode',
            mode
        };
    }

    /**
     * Inicia animación de espera/pausa
     * @param {object} options - Opciones de la animación
     * @returns {Promise<object>}
     */
    async startPauseAnimation(options = {}) {
        return this.setIdleState('relaxed');
    }

    /**
     * Obtiene gestos disponibles
     * @returns {string[]}
     */
    getAvailableGestures() {
        return this.availableGestures;
    }

    /**
     * Obtiene el estado actual
     * @returns {object}
     */
    getCurrentState() {
        return {
            state: this.currentState,
            availableGestures: this.availableGestures
        };
    }
}

export default AvatarMovementService;
