/**
 * ElevatorSensorService - Servicio de sensor de ascensor
 * 
 * PLACEHOLDER: Este servicio está preparado para implementar:
 * - Detección de apertura de puerta de ascensor
 * - Activación del asistente al detectar llegada
 * 
 * @future Integrar con sensores de puerta o API del edificio
 */
import { SensorBaseService } from './SensorBaseService.js';

export class ElevatorSensorService extends SensorBaseService {
    constructor(options = {}) {
        super('ElevatorSensorService', { ...options, deviceType: 'elevator_sensor' });

        this.doorStatus = 'closed';
        this.lastOpened = null;
        this.eventCallbacks = [];
    }

    async initialize() {
        await super.initialize();

        if (!this.enabled) return false;

        this.log('Servicio de sensor de ascensor preparado');
        this._isReady = true;
        return true;
    }

    /**
     * Registra callback para evento de puerta abierta
     * @param {Function} callback - Función a llamar
     */
    onDoorOpen(callback) {
        this.eventCallbacks.push({ event: 'open', callback });
    }

    /**
     * Registra callback para evento de puerta cerrada
     * @param {Function} callback - Función a llamar
     */
    onDoorClose(callback) {
        this.eventCallbacks.push({ event: 'close', callback });
    }

    /**
     * Simula apertura de puerta (para testing o trigger manual)
     */
    simulateDoorOpen() {
        this.doorStatus = 'open';
        this.lastOpened = new Date();
        this.log('Puerta de ascensor abierta');

        this._triggerCallbacks('open');
    }

    /**
     * Simula cierre de puerta
     */
    simulateDoorClose() {
        this.doorStatus = 'closed';
        this.log('Puerta de ascensor cerrada');

        this._triggerCallbacks('close');
    }

    /**
     * Dispara callbacks registrados
     * @param {string} eventType - Tipo de evento
     */
    _triggerCallbacks(eventType) {
        for (const { event, callback } of this.eventCallbacks) {
            if (event === eventType) {
                try {
                    callback({
                        event: eventType,
                        timestamp: new Date(),
                        doorStatus: this.doorStatus
                    });
                } catch (error) {
                    this.log(`Error en callback: ${error.message}`, 'error');
                }
            }
        }
    }

    /**
     * Obtiene el estado actual
     * @returns {object}
     */
    getStatus() {
        return {
            doorStatus: this.doorStatus,
            lastOpened: this.lastOpened,
            callbacksRegistered: this.eventCallbacks.length,
            ...super.getStatus()
        };
    }
}

export default ElevatorSensorService;
