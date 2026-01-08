/**
 * IoTControlService - Servicio de control IoT funcional
 * 
 * Este servicio maneja los dispositivos IoT existentes (luces, showroom)
 * utilizando llamadas HTTP GET a endpoints Shelly y otros.
 * 
 * Integra con los comandos definidos en instrucciones.json
 */
import { BaseService } from '../base/BaseService.js';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class IoTControlService extends BaseService {
    constructor(options = {}) {
        super('IoTControlService', options);

        // Dispositivos registrados
        this.devices = new Map();
        this.commandHistory = [];
    }

    async initialize() {
        await super.initialize();

        if (!this.enabled) return false;

        // Cargar dispositivos desde instrucciones.json
        await this._loadDevicesFromConfig();

        this.log(`Inicializado con ${this.devices.size} dispositivos`);
        this._isReady = true;
        return true;
    }

    /**
     * Carga dispositivos desde instrucciones.json
     */
    async _loadDevicesFromConfig() {
        try {
            const configPath = join(__dirname, '../../data/extras/instrucciones.json');
            if (fs.existsSync(configPath)) {
                const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

                if (config.comandos && config.comandos.commands) {
                    for (const cmd of config.comandos.commands) {
                        // Extraer info del dispositivo desde el comando
                        const deviceId = cmd.id.replace(/_on|_off/g, '');
                        const action = cmd.id.includes('_on') ? 'on' : 'off';

                        if (!this.devices.has(deviceId)) {
                            this.devices.set(deviceId, {
                                id: deviceId,
                                name: this._extractDeviceName(cmd.triggers[0]),
                                endpoints: {},
                                status: 'unknown',
                                lastAction: null
                            });
                        }

                        const device = this.devices.get(deviceId);
                        device.endpoints[action] = cmd.args.url;
                    }
                }
            }
        } catch (error) {
            this.log(`Error cargando configuración: ${error.message}`, 'error');
        }
    }

    /**
     * Extrae nombre del dispositivo desde trigger
     */
    _extractDeviceName(trigger) {
        // "prende el showroom" -> "showroom"
        const parts = trigger.split(' ');
        return parts[parts.length - 1] || trigger;
    }

    /**
     * Ejecuta una acción en un dispositivo
     * @param {string} deviceId - ID del dispositivo
     * @param {string} action - Acción ('on' o 'off')
     * @returns {Promise<object>}
     */
    async executeAction(deviceId, action) {
        if (!this._isReady) {
            return { error: 'Servicio IoT no disponible' };
        }

        const device = this.devices.get(deviceId);
        if (!device) {
            // Intentar buscar por nombre parcial
            for (const [id, dev] of this.devices) {
                if (id.includes(deviceId) || dev.name.includes(deviceId)) {
                    return this.executeAction(id, action);
                }
            }
            return { error: `Dispositivo no encontrado: ${deviceId}` };
        }

        const url = device.endpoints[action];
        if (!url) {
            return { error: `Acción "${action}" no disponible para ${deviceId}` };
        }

        this.log(`Ejecutando ${action} en ${deviceId}: ${url}`);

        try {
            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'AsistenteRecepcion/1.0',
                    'Accept': '*/*'
                }
            });

            const text = await response.text();

            // Actualizar estado del dispositivo
            device.status = action;
            device.lastAction = new Date();

            // Registrar en historial
            this.commandHistory.push({
                deviceId,
                action,
                url,
                status: response.status,
                timestamp: new Date()
            });

            return {
                success: true,
                deviceId,
                action,
                statusCode: response.status,
                response: text.substring(0, 100)
            };
        } catch (error) {
            this.log(`Error ejecutando acción: ${error.message}`, 'error');
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Enciende un dispositivo
     * @param {string} deviceId 
     */
    async turnOn(deviceId) {
        return this.executeAction(deviceId, 'on');
    }

    /**
     * Apaga un dispositivo
     * @param {string} deviceId 
     */
    async turnOff(deviceId) {
        return this.executeAction(deviceId, 'off');
    }

    /**
     * Lista todos los dispositivos registrados
     * @returns {object[]}
     */
    listDevices() {
        return Array.from(this.devices.values());
    }

    /**
     * Obtiene el estado de un dispositivo
     * @param {string} deviceId 
     * @returns {object|null}
     */
    getDeviceStatus(deviceId) {
        return this.devices.get(deviceId) || null;
    }

    /**
     * Obtiene el historial de comandos
     * @param {number} limit 
     * @returns {object[]}
     */
    getHistory(limit = 10) {
        return this.commandHistory.slice(-limit);
    }

    /**
     * Registra un nuevo dispositivo manualmente
     * @param {object} deviceConfig 
     */
    registerDevice(deviceConfig) {
        const device = {
            id: deviceConfig.id,
            name: deviceConfig.name || deviceConfig.id,
            endpoints: deviceConfig.endpoints || {},
            status: 'unknown',
            lastAction: null
        };
        this.devices.set(device.id, device);
        this.log(`Dispositivo registrado: ${device.id}`);
        return device;
    }
}

export default IoTControlService;
