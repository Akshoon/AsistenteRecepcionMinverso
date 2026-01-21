// Script para extraer certificado y clave de PFX
import fs from 'fs';
import { execSync } from 'child_process';

const pfxPath = 'C:\\certificados\\minverso.pfx';
const certPath = 'C:\\certificados\\cert.pem';
const keyPath = 'C:\\certificados\\key.pem';

// Intentar con contraseñas comunes
const commonPasswords = ['', 'minverso', '123456', 'password', 'admin'];

console.log('Intentando extraer certificado del archivo PFX...\n');

for (const password of commonPasswords) {
    try {
        console.log(`Probando contraseña: "${password || '(vacía)'}"`);

        // Leer el archivo PFX
        const pfxBuffer = fs.readFileSync(pfxPath);

        // Intentar cargar con Node.js
        const https = await import('https');
        const tls = await import('tls');

        try {
            const secureContext = tls.createSecureContext({
                pfx: pfxBuffer,
                passphrase: password
            });

            console.log(`✅ ¡Contraseña correcta encontrada: "${password || '(vacía)'}"`);
            console.log('\nActualiza vite.config.js y server/index.js con:');
            console.log(`passphrase: '${password}'`);
            process.exit(0);
        } catch (e) {
            if (e.message.includes('mac verify failure')) {
                console.log(`❌ Contraseña incorrecta`);
            } else {
                throw e;
            }
        }
    } catch (error) {
        console.error(`Error: ${error.message}`);
    }
}

console.log('\n⚠️ No se pudo encontrar la contraseña correcta.');
console.log('Por favor, proporciona la contraseña del certificado PFX.');
