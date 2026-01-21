// Script de verificación rápida del certificado
import fs from 'fs';
import tls from 'tls';

const pfxPath = 'C:\\certificados\\minverso.pfx';
const password = 'minverso123';

console.log('🔍 Verificando certificado PFX...\n');

try {
    const pfxBuffer = fs.readFileSync(pfxPath);
    console.log(`✅ Archivo PFX leído correctamente (${pfxBuffer.length} bytes)`);

    const secureContext = tls.createSecureContext({
        pfx: pfxBuffer,
        passphrase: password
    });

    console.log('✅ Certificado cargado exitosamente con la contraseña');
    console.log('✅ Configuración HTTPS lista para usar\n');
    console.log('Ahora puedes reiniciar los servidores:');
    console.log('  1. npm run server');
    console.log('  2. npm run dev');

} catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
}
