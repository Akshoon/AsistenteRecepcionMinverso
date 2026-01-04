import { BaseTTS } from './BaseTTS.js';
import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

export class ElevenLabsTTS extends BaseTTS {
    constructor(config = {}) {
        super(config);
        this.apiKey = config.apiKey || process.env.ELEVENLABS_API_KEY;
        this.voiceId = config.voiceId || process.env.ELEVENLABS_VOICE_ID;
        this.model = config.model || 'eleven_multilingual_v2';
    }

    isConfigured() {
        return !!(this.apiKey && this.voiceId);
    }

    async textToSpeech(text) {
        if (!this.isConfigured()) {
            throw new Error('ElevenLabs API Key o Voice ID no configurados');
        }

        console.log('ElevenLabs: Generando audio para:', text.substring(0, 50) + '...');

        // Optimizar texto para reducir caracteres enviados
        let optimizedText = text
            // Remover emojis y símbolos Unicode
            .replace(/[\u{1F600}-\u{1F64F}]/gu, '') // Emoticons
            .replace(/[\u{1F300}-\u{1F5FF}]/gu, '') // Misc Symbols
            .replace(/[\u{1F680}-\u{1F6FF}]/gu, '') // Transport & Map
            .replace(/[\u{1F1E0}-\u{1F1FF}]/gu, '') // Flags
            .replace(/[\u{2600}-\u{26FF}]/gu, '')   // Misc symbols
            .replace(/[\u{2700}-\u{27BF}]/gu, '')   // Dingbats
            .replace(/[\u{FE00}-\u{FE0F}]/gu, '')   // Variation Selectors
            .replace(/[\u{1F900}-\u{1F9FF}]/gu, '') // Supplemental Symbols
            .replace(/[\u{1FA00}-\u{1FA6F}]/gu, '') // Chess Symbols
            .replace(/[\u{1FA70}-\u{1FAFF}]/gu, '') // Symbols Extended-A
            // Remover espacios múltiples
            .replace(/\s+/g, ' ')
            // Remover puntuación redundante
            .replace(/\.{2,}/g, '.')
            .replace(/!{2,}/g, '!')
            .replace(/\?{2,}/g, '?')
            .replace(/,{2,}/g, ',')
            // Remover espacios antes de puntuación
            .replace(/\s+([.,!?;:])/g, '$1')
            // Trim
            .trim();

        console.log(`ElevenLabs: Texto optimizado (${text.length} -> ${optimizedText.length} chars)`);

        const response = await fetch(
            `https://api.elevenlabs.io/v1/text-to-speech/${this.voiceId}`,
            {
                method: 'POST',
                headers: {
                    'Accept': 'audio/mpeg',
                    'Content-Type': 'application/json',
                    'xi-api-key': this.apiKey
                },
                body: JSON.stringify({
                    text: optimizedText,
                    model_id: this.model,
                    voice_settings: {
                        stability: 0.5,
                        similarity_boost: 0.75,
                        style: 0.0,
                        use_speaker_boost: true
                    }
                })
            }
        );

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Error API ElevenLabs: ${response.status} - ${error}`);
        }

        const audioBuffer = await response.arrayBuffer();
        console.log('ElevenLabs: Audio generado, tamaño:', audioBuffer.byteLength, 'bytes');

        return Buffer.from(audioBuffer);
    }
}
