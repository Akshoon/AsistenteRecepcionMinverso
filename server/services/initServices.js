/**
 * initServices.js - Inicialización unificada de todos los servicios
 * 
 * Este módulo inicializa y registra todos los servicios activos
 * basándose en la configuración de integrations_config.json
 */
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

import { ServiceRegistry, serviceRegistry } from './base/ServiceRegistry.js';

// Servicios funcionales
import { IoTControlService } from './iot/IoTControlService.js';
import { DataCollectionService } from './data/DataCollectionService.js';

// Servicios placeholder (para futuro)
import { CalendarService } from './calendar/CalendarService.js';
import { MediaDisplayService } from './media/MediaDisplayService.js';
import { WebDisplayService } from './media/WebDisplayService.js';
import { AvatarMovementService } from './avatar/AvatarMovementService.js';
import { PersonRecognitionService } from './recognition/PersonRecognitionService.js';
import { WhatsAppCallService } from './whatsapp/WhatsAppCallService.js';
import { DoorControlService } from './iot/DoorControlService.js';
import { MusicService } from './iot/MusicService.js';
import { CameraService } from './iot/CameraService.js';
import { ElevatorSensorService } from './iot/ElevatorSensorService.js';
import { HomeSensorService } from './iot/HomeSensorService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Carga la configuración de integraciones
 * @returns {object}
 */
function loadIntegrationsConfig() {
    try {
        const configPath = join(__dirname, '../data/extras/integrations_config.json');
        if (fs.existsSync(configPath)) {
            return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        }
    } catch (error) {
        console.error('[initServices] Error cargando config:', error.message);
    }
    return {};
}

/**
 * Inicializa todos los servicios según la configuración
 * @param {object} externalServices - Servicios externos (ej: whatsappService ya inicializado)
 * @returns {Promise<ServiceRegistry>}
 */
export async function initializeServices(externalServices = {}) {
    const config = loadIntegrationsConfig();
    console.log('[initServices] Inicializando servicios...');

    // === SERVICIOS FUNCIONALES ===

    // IoT Control (luces, showroom) - ACTIVO
    if (config.iot_lights?.enabled !== false) {
        const iotService = new IoTControlService({ enabled: true });
        serviceRegistry.register('iot', iotService);
    }

    // Data Collection - ACTIVO (en memoria)
    if (config.data_collection?.enabled !== false) {
        const dataService = new DataCollectionService({ enabled: true });
        serviceRegistry.register('data', dataService);
    }

    // === SERVICIOS PLACEHOLDER (para futuro) ===

    // Calendar
    if (config.calendar?.enabled) {
        const calendarService = new CalendarService({
            enabled: true,
            calendarType: config.calendar.type,
            credentials: config.calendar.credentials_path
        });
        serviceRegistry.register('calendar', calendarService);
    }

    // Media Display
    if (config.media_display?.enabled) {
        const mediaService = new MediaDisplayService({
            enabled: true,
            mediaPath: config.media_display.media_path
        });
        serviceRegistry.register('media', mediaService);
    }

    // Web Display
    if (config.web_display?.enabled) {
        const webService = new WebDisplayService({
            enabled: true,
            allowedDomains: config.web_display.allowed_domains
        });
        serviceRegistry.register('web', webService);
    }

    // Avatar Movements
    if (config.avatar_movements?.enabled) {
        const avatarService = new AvatarMovementService({ enabled: true });
        serviceRegistry.register('avatar', avatarService);
    }

    // Person Recognition
    if (config.person_recognition?.enabled) {
        const recognitionService = new PersonRecognitionService({ enabled: true });
        serviceRegistry.register('recognition', recognitionService);
    }

    // WhatsApp Calls
    if (config.whatsapp_calls?.enabled) {
        const callService = new WhatsAppCallService({ enabled: true });
        serviceRegistry.register('whatsappCalls', callService);
    }

    // IoT Sensors
    if (config.iot_sensors?.doors?.enabled) {
        const doorService = new DoorControlService({ enabled: true });
        serviceRegistry.register('doors', doorService);
    }

    if (config.iot_sensors?.music?.enabled) {
        const musicService = new MusicService({ enabled: true });
        serviceRegistry.register('music', musicService);
    }

    if (config.iot_sensors?.cameras?.enabled) {
        const cameraService = new CameraService({ enabled: true });
        serviceRegistry.register('cameras', cameraService);
    }

    if (config.iot_sensors?.elevator?.enabled) {
        const elevatorService = new ElevatorSensorService({ enabled: true });
        serviceRegistry.register('elevator', elevatorService);
    }

    if (config.iot_sensors?.home_sensors?.enabled) {
        const homeService = new HomeSensorService({ enabled: true });
        serviceRegistry.register('homeSensors', homeService);
    }

    // Inicializar todos los servicios registrados
    await serviceRegistry.initializeAll();

    // Log de servicios activos
    const statuses = serviceRegistry.getStatus();
    console.log(`[initServices] ${statuses.length} servicios registrados:`);
    for (const s of statuses) {
        console.log(`  - ${s.name}: ${s.isReady ? '✓ Listo' : '○ Pendiente'}`);
    }

    return serviceRegistry;
}

/**
 * Obtiene un servicio por nombre
 * @param {string} name 
 * @returns {BaseService|null}
 */
export function getService(name) {
    return serviceRegistry.get(name);
}

/**
 * Obtiene el IoT service (acceso rápido)
 * @returns {IoTControlService|null}
 */
export function getIoTService() {
    return serviceRegistry.get('iot');
}

/**
 * Obtiene el Data Collection service (acceso rápido)
 * @returns {DataCollectionService|null}
 */
export function getDataService() {
    return serviceRegistry.get('data');
}

export { serviceRegistry };
export default initializeServices;
