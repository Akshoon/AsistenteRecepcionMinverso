/**
 * CameraService - Servicio de cámaras con reconocimiento facial
 * 
 * PLACEHOLDER: Este servicio está preparado para implementar:
 * - Monitoreo de cámaras
 * - Detección de personas
 * - Diálogos basados en reconocimiento facial
 * 
 * @future Integrar con cámaras IP y APIs de reconocimiento facial
 */
import { SensorBaseService } from './SensorBaseService.js';

export class CameraService extends SensorBaseService {
    constructor(options = {}) {
        super('CameraService', { ...options, deviceType: 'camera' });

        this.cameras = new Map();
        this.isMonitoring = false;
        this.detectionCallbacks = [];
    }

    async initialize() {
        await super.initialize();

        if (!this.enabled) return false;

        this.log('Servicio de cámaras preparado');
        this._isReady = true;
        return true;
    }

    /**
     * Registra una cámara
     * @param {string} cameraId - ID de la cámara
     * @param {object} config - Configuración
     */
    registerCamera(cameraId, config) {
        this.cameras.set(cameraId, {
            id: cameraId,
            name: config.name || cameraId,
            streamUrl: config.streamUrl || null,
            location: config.location || 'unknown',
            status: 'inactive'
        });
        this.log(`Cámara registrada: ${cameraId}`);
    }

    /**
     * Inicia monitoreo de cámaras
     * @param {object} options - Opciones de monitoreo
     * @returns {Promise<object>}
     */
    async startMonitoring(options = {}) {
        if (!this._isReady) {
            return { error: 'Servicio de cámaras no disponible' };
        }

        this.isMonitoring = true;
        this.log('Monitoreo iniciado');

        // TODO: Iniciar análisis de video real
        return {
            action: 'start_monitoring',
            success: true,
            placeholder: true
        };
    }

    /**
     * Detiene el monitoreo
     * @returns {Promise<object>}
     */
    async stopMonitoring() {
        this.isMonitoring = false;
        this.log('Monitoreo detenido');

        return {
            action: 'stop_monitoring',
            success: true
        };
    }

    /**
     * Captura un frame de la cámara
     * @param {string} cameraId - ID de la cámara
     * @returns {Promise<object>}
     */
    async captureFrame(cameraId = 'main') {
        if (!this._isReady) {
            return { error: 'Servicio de cámaras no disponible' };
        }

        this.log(`Capturando frame de: ${cameraId}`);

        // TODO: Capturar frame real
        return {
            cameraId,
            frame: null,
            timestamp: new Date(),
            placeholder: true
        };
    }

    /**
     * Registra callback para detección de personas
     * @param {Function} callback - Función a llamar cuando se detecte una persona
     */
    onPersonDetected(callback) {
        this.detectionCallbacks.push(callback);
    }

    /**
     * Dispara callbacks de detección (para simulación/testing)
     * @param {object} detectionData - Datos de la detección
     */
    triggerDetection(detectionData) {
        for (const callback of this.detectionCallbacks) {
            try {
                callback(detectionData);
            } catch (error) {
                this.log(`Error en callback de detección: ${error.message}`, 'error');
            }
        }
    }

    /**
     * Lista todas las cámaras registradas
     * @returns {object[]}
     */
    listCameras() {
        return Array.from(this.cameras.values());
    }

    /**
     * Obtiene estado del monitoreo
     * @returns {object}
     */
    getMonitoringStatus() {
        return {
            isMonitoring: this.isMonitoring,
            cameraCount: this.cameras.size,
            callbackCount: this.detectionCallbacks.length
        };
    }
}

export default CameraService;
