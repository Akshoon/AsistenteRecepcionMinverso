/**
 * MediaDisplayService - Servicio de exhibición de medios
 * 
 * PLACEHOLDER: Este servicio está preparado para implementar:
 * - Exhibición de videos
 * - Exhibición de imágenes
 * - Gestión de playlists de contenido
 * 
 * @future Integrar con frontend para mostrar contenido en pantalla
 */
import { BaseService } from '../base/BaseService.js';

export class MediaDisplayService extends BaseService {
    constructor(options = {}) {
        super('MediaDisplayService', options);

        // Configuración
        this.mediaPath = options.mediaPath || './media';
        this.currentMedia = null;
        this.playlist = [];
    }

    async initialize() {
        await super.initialize();

        if (!this.enabled) return false;

        this.log('Servicio de media display preparado');
        this._isReady = true;
        return true;
    }

    /**
     * Muestra una imagen en pantalla
     * @param {string} imagePath - Ruta o URL de la imagen
     * @param {object} options - Opciones (duración, transición, etc.)
     * @returns {Promise<object>}
     */
    async showImage(imagePath, options = {}) {
        if (!this._isReady) {
            return { error: 'Servicio de media no disponible' };
        }

        this.currentMedia = {
            type: 'image',
            path: imagePath,
            options,
            startedAt: new Date()
        };

        this.log(`Mostrando imagen: ${imagePath}`);

        // TODO: Enviar comando al frontend vía WebSocket
        return {
            action: 'show_image',
            path: imagePath,
            options
        };
    }

    /**
     * Reproduce un video
     * @param {string} videoPath - Ruta o URL del video
     * @param {object} options - Opciones (loop, muted, etc.)
     * @returns {Promise<object>}
     */
    async playVideo(videoPath, options = {}) {
        if (!this._isReady) {
            return { error: 'Servicio de media no disponible' };
        }

        this.currentMedia = {
            type: 'video',
            path: videoPath,
            options,
            startedAt: new Date()
        };

        this.log(`Reproduciendo video: ${videoPath}`);

        // TODO: Enviar comando al frontend vía WebSocket
        return {
            action: 'play_video',
            path: videoPath,
            options
        };
    }

    /**
     * Detiene la reproducción actual
     * @returns {Promise<object>}
     */
    async stopMedia() {
        if (!this._isReady) {
            return { error: 'Servicio de media no disponible' };
        }

        const previous = this.currentMedia;
        this.currentMedia = null;

        this.log('Media detenido');

        // TODO: Enviar comando al frontend vía WebSocket
        return {
            action: 'stop_media',
            previous
        };
    }

    /**
     * Obtiene la lista de medios disponibles
     * @returns {Promise<object[]>}
     */
    async getMediaList() {
        // TODO: Escanear directorio de medios
        return {
            images: [],
            videos: [],
            placeholder: true
        };
    }

    /**
     * Agrega media a la playlist
     * @param {object} mediaItem - Item de media
     */
    addToPlaylist(mediaItem) {
        this.playlist.push(mediaItem);
    }

    /**
     * Obtiene el estado actual de reproducción
     * @returns {object}
     */
    getCurrentStatus() {
        return {
            currentMedia: this.currentMedia,
            playlistLength: this.playlist.length
        };
    }
}

export default MediaDisplayService;
