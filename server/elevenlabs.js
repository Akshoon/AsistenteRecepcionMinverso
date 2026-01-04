import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const ELEVENLABS_VOICE_ID = process.env.ELEVENLABS_VOICE_ID;
const ELEVENLABS_MODEL = 'eleven_multilingual_v2'; // Modelo más compatible

/**
 * Convierte texto a audio usando ElevenLabs API
 * @param {string} text - Texto a convertir
 * @returns {Promise<Buffer>} - Audio en formato PCM
 */
export async function textToSpeech(text) {
    if (!ELEVENLABS_API_KEY || !ELEVENLABS_VOICE_ID) {
        throw new Error('ElevenLabs API Key o Voice ID no configurados en .env');
    }

    console.log('🔊 ElevenLabs: Generando audio para:', text.substring(0, 50) + '...');

    const response = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}`,
        {
            method: 'POST',
            headers: {
                'Accept': 'audio/mpeg',
                'Content-Type': 'application/json',
                'xi-api-key': ELEVENLABS_API_KEY
            },
            body: JSON.stringify({
                text: text,
                model_id: ELEVENLABS_MODEL,
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
        throw new Error(`ElevenLabs API error: ${response.status} - ${error}`);
    }

    const audioBuffer = await response.arrayBuffer();
    console.log('✅ ElevenLabs: Audio generado, tamaño:', audioBuffer.byteLength, 'bytes');

    return Buffer.from(audioBuffer);
}

/**
 * Genera audio en streaming (para respuestas largas)
 */
export async function textToSpeechStream(text) {
    if (!ELEVENLABS_API_KEY || !ELEVENLABS_VOICE_ID) {
        throw new Error('ElevenLabs API Key o Voice ID no configurados en .env');
    }

    const response = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}/stream`,
        {
            method: 'POST',
            headers: {
                'Accept': 'audio/mpeg',
                'Content-Type': 'application/json',
                'xi-api-key': ELEVENLABS_API_KEY
            },
            body: JSON.stringify({
                text: text,
                model_id: ELEVENLABS_MODEL,
                voice_settings: {
                    stability: 0.5,
                    similarity_boost: 0.75
                }
            })
        }
    );

    if (!response.ok) {
        throw new Error(`ElevenLabs streaming error: ${response.status}`);
    }

    return response.body;
}

export function isConfigured() {
    return !!(ELEVENLABS_API_KEY && ELEVENLABS_VOICE_ID);
}
