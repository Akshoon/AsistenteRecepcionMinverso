import { generarEmbedding } from './embeddings.js';
import fs from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Base de datos en memoria (sin necesidad de servidor externo)
let documentos = [];
let embeddings = [];
let metadatas = [];

/**
 * Inicializa la base de vectores en memoria
 */
export async function initVectorStore() {
    try {
        console.log('📊 Inicializando base de vectores en memoria...');
        await indexarDocumentos();
        console.log(`✅ Base de vectores lista con ${documentos.length} chunks`);
        return true;
    } catch (error) {
        console.error('❌ Error inicializando base de vectores:', error.message);
        return false;
    }
}

/**
 * Indexa todos los documentos de la carpeta documentos/
 */
async function indexarDocumentos() {
    const docsPath = join(__dirname, '..', 'data', 'documentos');

    if (!fs.existsSync(docsPath)) {
        fs.mkdirSync(docsPath, { recursive: true });
        console.log('📁 Carpeta documentos/ creada. Agrega archivos .txt para indexar.');
        return;
    }

    const archivos = fs.readdirSync(docsPath).filter(f => f.endsWith('.txt'));

    if (archivos.length === 0) {
        console.log('📁 No hay documentos para indexar en documentos/');
        return;
    }

    console.log(`📖 Indexando ${archivos.length} documentos...`);

    // Limpiar datos anteriores
    documentos = [];
    embeddings = [];
    metadatas = [];

    for (const archivo of archivos) {
        const contenido = fs.readFileSync(join(docsPath, archivo), 'utf-8');

        // Dividir en chunks de ~500 caracteres
        const chunks = dividirEnChunks(contenido, 500);

        console.log(`  📄 ${archivo}: ${chunks.length} chunks`);

        for (let i = 0; i < chunks.length; i++) {
            documentos.push(chunks[i]);
            metadatas.push({
                archivo: archivo,
                chunk: i
            });

            // Generar embedding
            try {
                const emb = await generarEmbedding(chunks[i]);
                embeddings.push(emb);
            } catch (error) {
                console.error(`  ⚠️ Error en chunk ${i} de ${archivo}:`, error.message);
                embeddings.push(null);
            }
        }
    }

    console.log(`✅ ${documentos.length} chunks indexados`);
}

/**
 * Divide texto en chunks de tamaño aproximado
 */
function dividirEnChunks(texto, tamano) {
    const chunks = [];
    const parrafos = texto.split('\n\n');
    let chunkActual = '';

    for (const parrafo of parrafos) {
        if ((chunkActual + parrafo).length > tamano && chunkActual.length > 0) {
            chunks.push(chunkActual.trim());
            chunkActual = parrafo;
        } else {
            chunkActual += (chunkActual ? '\n\n' : '') + parrafo;
        }
    }

    if (chunkActual.trim()) {
        chunks.push(chunkActual.trim());
    }

    return chunks.length > 0 ? chunks : [texto];
}

/**
 * Calcula similitud coseno entre dos vectores
 */
function cosineSimilarity(a, b) {
    if (!a || !b || a.length !== b.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
        dotProduct += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Busca en la base de conocimientos de Minverso
 * @param {string} consulta - Tema técnico a buscar
 * @returns {Promise<string>} - Texto con los resultados
 */
export async function buscarProtocoloMinero(consulta) {
    if (documentos.length === 0) {
        return 'Base de conocimientos vacía. Agrega documentos a server/data/documentos/';
    }

    try {
        console.log(`🔍 Buscando: "${consulta}"`);

        // Generar embedding de la consulta
        const queryEmbedding = await generarEmbedding(consulta);

        // Calcular similitud con todos los documentos
        const scores = embeddings.map((emb, i) => ({
            index: i,
            score: cosineSimilarity(queryEmbedding, emb),
            documento: documentos[i],
            metadata: metadatas[i]
        }));

        // Ordenar por mayor similitud y tomar los 3 mejores
        const topResults = scores
            .filter(s => s.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, 3);

        if (topResults.length === 0) {
            return 'No se encontró información específica sobre ese tema.';
        }

        // Combinar resultados
        const textoEncontrado = topResults
            .map(r => `[${r.metadata.archivo}]\n${r.documento}`)
            .join('\n\n---\n\n');

        console.log(`📄 Encontrados ${topResults.length} fragmentos (mejor score: ${topResults[0].score.toFixed(3)})`);

        return `Información encontrada:\n\n${textoEncontrado}`;

    } catch (error) {
        console.error('❌ Error buscando:', error);
        return 'Error al buscar en la base de conocimientos.';
    }
}
