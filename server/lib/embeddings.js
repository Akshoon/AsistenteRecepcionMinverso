import dotenv from 'dotenv';

dotenv.config();

const API_KEY = process.env.GOOGLE_API_KEY;
const EMBED_URL = `https://generativelanguage.googleapis.com/v1/models/text-embedding-004:embedContent?key=${API_KEY}`;

/**
 * Genera un embedding para un texto usando la API REST de Gemini
 * @param {string} texto - Texto a convertir en vector
 * @returns {Promise<number[]>} - Vector de embedding
 */
export async function generarEmbedding(texto) {
    try {
        const response = await fetch(EMBED_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                content: {
                    parts: [{ text: texto }]
                }
            })
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`API error: ${error}`);
        }

        const data = await response.json();
        return data.embedding.values;

    } catch (error) {
        console.error('Error generando embedding:', error.message);
        throw error;
    }
}
