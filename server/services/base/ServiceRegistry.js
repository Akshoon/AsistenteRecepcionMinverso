/**
 * ServiceRegistry - Registro central de servicios
 * 
 * Gestiona el ciclo de vida de todos los servicios,
 * permite inyección de dependencias y acceso centralizado.
 */
export class ServiceRegistry {
    constructor() {
        this.services = new Map();
        this.initialized = false;
    }

    /**
     * Registra un servicio en el registro
     * @param {string} name - Nombre único del servicio
     * @param {BaseService} service - Instancia del servicio
     */
    register(name, service) {
        if (this.services.has(name)) {
            console.warn(`[ServiceRegistry] Servicio "${name}" ya registrado, sobrescribiendo...`);
        }
        this.services.set(name, service);
        console.log(`[ServiceRegistry] Servicio "${name}" registrado`);
    }

    /**
     * Obtiene un servicio por nombre
     * @param {string} name 
     * @returns {BaseService|null}
     */
    get(name) {
        return this.services.get(name) || null;
    }

    /**
     * Obtiene todos los servicios registrados
     * @returns {Map}
     */
    getAll() {
        return this.services;
    }

    /**
     * Inicializa todos los servicios registrados
     * @returns {Promise<void>}
     */
    async initializeAll() {
        console.log('[ServiceRegistry] Inicializando todos los servicios...');

        for (const [name, service] of this.services) {
            try {
                await service.initialize();
            } catch (error) {
                console.error(`[ServiceRegistry] Error inicializando "${name}":`, error);
            }
        }

        this.initialized = true;
        console.log(`[ServiceRegistry] ${this.services.size} servicios procesados`);
    }

    /**
     * Apaga todos los servicios de forma segura
     * @returns {Promise<void>}
     */
    async shutdownAll() {
        console.log('[ServiceRegistry] Apagando todos los servicios...');

        for (const [name, service] of this.services) {
            try {
                await service.shutdown();
            } catch (error) {
                console.error(`[ServiceRegistry] Error apagando "${name}":`, error);
            }
        }

        this.initialized = false;
    }

    /**
     * Obtiene el estado de todos los servicios
     * @returns {object[]}
     */
    getStatus() {
        const statuses = [];
        for (const [, service] of this.services) {
            statuses.push(service.getStatus());
        }
        return statuses;
    }

    /**
     * Verifica si un servicio está disponible y listo
     * @param {string} name 
     * @returns {Promise<boolean>}
     */
    async isServiceReady(name) {
        const service = this.get(name);
        if (!service) return false;
        return await service.isReady();
    }
}

// Singleton instance
export const serviceRegistry = new ServiceRegistry();
export default ServiceRegistry;
