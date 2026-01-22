# Debug: Lip-Sync No Funciona

## Problema Identificado

El `audioStream` que se está pasando al `Avatar3D` es `geminiStream`, que es el **stream de SALIDA** del avatar (el audio que genera), no el **stream de ENTRADA** que debería mover los labios.

## Lo Que Está Pasando

```javascript
// En HomePage.jsx línea 272
const dest = ctx.createMediaStreamDestination();
geminiAudioDestRef.current = dest;
setGeminiStream(dest.stream); // Este es el DESTINO del audio que SALE del sistema

// Luego se pasa al avatar (línea 928)
<Avatar3D audio Stream={geminiStream} /> // ❌ INCORRECTO
```

Este stream solo contiene el audio que **se está reproduciendo**, no el audio que **debería analizar** para mover los labios.

## Solución Requerida

El lip-sync necesita el mismo `audioStream` que se está reproduciendo para analizarlo en tiempo real. Hay dos opciones:

### Opción 1: Multi-conectar el Audio Source (RECOMENDADA)

Cuando se reproduce cada chunk de audio, conectar la fuente a múltiples destinos:
- `ctx.destination` (altavoces)
- Un `AnalyserNode` compartido con el Avatar para lip-sync

###  Opción 2: Usar el mismo geminiStream

El `geminiStream` **debería** funcionar, ya que tiene el audio que se está reproduciendo. El problema puede ser timing o que el stream no se esté llenando correctamente.

## Pasos de Debug

1. **Abre la consola del navegador** (F12)
2. **Recarga la página** (Ctrl+R o F5)  
3. **Busca los mensajes** que empiezan con `[useGeminiLipSync]` y `[useFormantAnalyzer]`
4. **Reporta** lo que ves:
   - ¿Dice "audioStream: EXISTS" o "audioStream: NULL"?
   - ¿Dice "active: true" o "active: false"?

## Verificación Manual

Para confirmar que el problema es el stream, puedes probar temporalmente deshabilitando el modo avanzado:

En `HomePage.jsx` línea 927-932, cambia:
```javascript
<Avatar3D
    audioStream={geminiStream}
    audioLevel={audioLevel}           // ← Esto es legacy pero debería funcionar
    lipSyncData={lipSyncState}        // ← Esto también
    emotionState={status.includes('Escuchando') ? 'neutral' : 'happy'}
    useAdvancedVisemes={false}         // ← AGREGAR ESTA LÍNEA
/>
```

Si eso tampoco funciona, el problema es más profundo (el hook original tampoco está recibiendo señal).
