import { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';

export default function Avatar3D({ audioLevel = 0, lipSyncData = null }) {
    const group = useRef();
    const { scene } = useGLTF('/avatar.glb');

    const morphMeshes = useRef([]);
    const bonesRef = useRef({});
    const timeRef = useRef(0);
    const smoothedLevel = useRef(0);
    const smoothedLipSync = useRef({
        mouthOpen: 0,
        mouthWide: 0,
        jawOpen: 0,
        lipsPursed: 0,
        tongueOut: 0
    });

    useEffect(() => {
        morphMeshes.current = [];
        bonesRef.current = {};

        scene.traverse((child) => {
            // Recopilar morph targets
            if (child.isMesh && child.morphTargetDictionary && child.morphTargetInfluences) {
                morphMeshes.current.push(child);
                console.log('🎭 MorphTargets FOUND:', child.name, 'Influences:', child.morphTargetInfluences.length);
                if (child.name.includes("Body")) {
                    console.log('Detected Body Mesh:', child.name);
                }
            }

            // Recopilar huesos del esqueleto
            if (child.isBone) {
                bonesRef.current[child.name] = child;
                console.log('🦴 Found Bone:', child.name); // Log all bones
            }
        });

        // Exponer para debug desde consola
        window._morphMeshes = morphMeshes.current;

        // Función para probar índices de morph
        window.testMorphIndex = (index, value = 1) => {
            const key = String(index);
            const modifiedMeshes = [];
            for (const mesh of morphMeshes.current) {
                if (mesh.morphTargetDictionary[key] !== undefined) {
                    mesh.morphTargetInfluences[mesh.morphTargetDictionary[key]] = value;
                    modifiedMeshes.push(mesh.name);
                    console.log(`✅ Morph ${index} = ${value} en ${mesh.name}`);
                }
            }
            if (modifiedMeshes.length === 0) console.log(`❌ Morph ${index} no encontrado`);
            return modifiedMeshes.length > 0 ? `Editado: ${modifiedMeshes.join(', ')}` : 'No encontrado';
        };

        // Función para escanear y encontrar morphs de boca
        window.scanMorphs = (start = 0, end = 50, delay = 500) => {
            console.log(`🔍 Escaneando morphs ${start}-${end}. Observa la cara y anota cuando veas la boca moverse.`);
            let current = start;
            window._scanInterval = setInterval(() => {
                if (current > end) {
                    clearInterval(window._scanInterval);
                    // Reset
                    for (let i = start; i <= end; i++) window.testMorphIndex(i, 0);
                    console.log('✅ Escaneo terminado');
                    return;
                }
                if (current > start) window.testMorphIndex(current - 1, 0);
                console.log(`📍 Índice ${current}`);
                window.testMorphIndex(current, 0.8);
                current++;
            }, delay);
        };

        window.stopScan = () => {
            if (window._scanInterval) clearInterval(window._scanInterval);
            for (let i = 0; i < 200; i++) window.testMorphIndex(i, 0);
            console.log('⏹️ Escaneo detenido');
        };

        console.log('🔧 Debug morphs: testMorphIndex(50, 0.8), scanMorphs(50, 100), stopScan()');

        // Mapeo EXACTO de huesos basado en los logs del usuario
        const exactTargets = [
            'CC_Base_L_Upperarm',
            'CC_Base_R_Upperarm',
            'CC_Base_L_Forearm',
            'CC_Base_R_Forearm'
        ];

        const foundBones = {};

        exactTargets.forEach(name => {
            if (bonesRef.current[name]) {
                foundBones[name] = bonesRef.current[name];
                console.log(`✅ EXACT MATCH: ${name}`);
            }
        });

        // Guardar para useFrame
        bonesRef.current.found = foundBones;
        console.log('🦴 Bones stored for frame update:', Object.keys(foundBones));

    }, [scene]);

    useFrame((state, delta) => {
        timeRef.current += delta;
        const t = timeRef.current;

        // === 0. MANTENER POSTURA (FORCE POSE) ===
        const found = bonesRef.current.found || {};

        const lArm = found['CC_Base_L_Upperarm'];
        const rArm = found['CC_Base_R_Upperarm'];
        const lFore = found['CC_Base_L_Forearm'];
        const rFore = found['CC_Base_R_Forearm'];

        if (lArm) {
            lArm.rotation.z = -1.4; // Brazos abajo
            lArm.rotation.x = 0;
            lArm.rotation.y = 0;
        }
        if (rArm) {
            rArm.rotation.z = 1.4;
            rArm.rotation.x = 0;
            rArm.rotation.y = 0;
        }
        if (lFore) {
            lFore.rotation.z = 0.1; // Relajado
            lFore.rotation.x = 0.2;
        }
        if (rFore) {
            rFore.rotation.z = -0.1;
            rFore.rotation.x = 0.2;
        }

        // === SUAVIZADO DE AUDIO ===
        smoothedLevel.current += (audioLevel - smoothedLevel.current) * 0.2;
        const level = smoothedLevel.current;

        // Suavizar lip sync data
        if (lipSyncData) {
            const s = 0.25;
            smoothedLipSync.current.mouthOpen += (lipSyncData.mouthOpen - smoothedLipSync.current.mouthOpen) * s;
            smoothedLipSync.current.mouthWide += (lipSyncData.mouthWide - smoothedLipSync.current.mouthWide) * s;
            smoothedLipSync.current.jawOpen += (lipSyncData.jawOpen - smoothedLipSync.current.jawOpen) * s;
            smoothedLipSync.current.lipsPursed += (lipSyncData.lipsPursed - smoothedLipSync.current.lipsPursed) * s;
        }
        const ls = smoothedLipSync.current;

        // === APLICAR A CADA MESH ===
        for (const mesh of morphMeshes.current) {
            const dict = mesh.morphTargetDictionary;
            const inf = mesh.morphTargetInfluences;
            if (!dict || !inf) continue;

            // FILTRAR: Aplicar a Body001 (cara), Tongue (lengua), y Teeth (dientes)
            const meshName = mesh.name;
            const isFaceMesh = meshName === 'CC_Base_Body001';
            const isTongueMesh = meshName.includes('Tongue');
            const isTeethMesh = meshName.includes('Teeth') || meshName.includes('Angled');

            // Helper: aplicar morph suavemente
            const set = (name, val, smooth = 0.3) => {
                if (dict[name] !== undefined) {
                    inf[dict[name]] += (Math.max(0, Math.min(1, val)) - inf[dict[name]]) * smooth;
                }
            };

            // =====================================================
            // 1. PARPADEO NATURAL (Índices 11, 12)
            // =====================================================
            const blinkCycle = t % 4; // Ciclo de 4 segundos
            let blink = 0;
            if (blinkCycle > 3.7 && blinkCycle < 3.9) {
                blink = Math.sin((blinkCycle - 3.7) / 0.2 * Math.PI);
            }
            // Micro-parpadeos aleatorios
            if (Math.random() < 0.003) blink = 0.6;

            set("Eye_Blink_L", blink, 0.5);
            set("Eye_Blink_R", blink, 0.5);

            // =====================================================
            // 2. BOCA / LIP SYNC (Índices 0, 1, 2, 46, 47, 72)
            // CON SUAVIZADO para movimientos naturales
            // =====================================================
            const GAIN = 1.0;
            // Usar valores suavizados para movimientos fluidos
            const mouthOpen = (lipSyncData ? ls.mouthOpen : level) * GAIN;
            const mouthWide = (lipSyncData ? ls.mouthWide : 0) * GAIN;
            const lipsPursed = (lipSyncData ? ls.lipsPursed : 0) * GAIN;

            // DEBUG: Ver si este mesh tiene morphs de labios
            if (dict["Ah"] !== undefined && mouthOpen > 0.1 && Math.random() < 0.01) {
                console.log(`🔴 ${mesh.name} (isFace=${isFaceMesh}): Ah=${mouthOpen.toFixed(2)}`);
            }

            // APLICAR MOVIMIENTO DE BOCA a mesh facial
            if (isFaceMesh) {
                // --- APERTURA PRINCIPAL (sutil, max 0.5) ---
                set("Ah", Math.min(mouthOpen * 0.5, 0.5), 0.4);
                set("Mouth_Drop_Lower", Math.min(mouthOpen * 0.2, 0.3), 0.3);

                // --- FORMAS REDONDAS (O, U) ---
                set("Oh", Math.min(lipsPursed * 0.5, 0.5), 0.4);
                set("W_OO", Math.min(lipsPursed * 0.4, 0.5), 0.4);
                set("Mouth_Pucker_Up_L", Math.min(lipsPursed * 0.25, 0.3), 0.3);
                set("Mouth_Pucker_Up_R", Math.min(lipsPursed * 0.25, 0.3), 0.3);

                // --- FORMAS ANCHAS (E, I) ---
                set("Mouth_Smile_L", Math.min(mouthWide * 0.2, 0.25), 0.4);
                set("Mouth_Smile_R", Math.min(mouthWide * 0.2, 0.25), 0.4);

                // --- CIERRE (M, B, P) ---
                const isSilent = level < 0.08;
                set("Mouth_Close", isSilent ? 0.1 : 0, 0.3);
            }

            // APLICAR A LENGUA (movimiento orgánico)
            if (isTongueMesh) {
                // Lengua se mueve sutilmente al hablar
                const tongueMove = level > 0.1 ? Math.sin(t * 6) * 0.15 : 0;
                set("Tongue_Out", Math.max(0, tongueMove * mouthOpen), 0.25);
                set("Tongue_Bulge_L", Math.max(0, tongueMove * 0.5), 0.2);
                set("Tongue_Bulge_R", Math.max(0, -tongueMove * 0.5), 0.2);
            }

            // APLICAR A DIENTES (siguen apertura de boca)
            if (isTeethMesh) {
                // Los dientes también tienen Ah para seguir la mandíbula
                set("Ah", Math.min(mouthOpen * 0.4, 0.4), 0.4);
            }

            // =====================================================
            // 3. CEJAS EXPRESIVAS (Índices 3-10)
            // =====================================================
            // Levantar cejas internas al hablar (interés)
            const browLift = level > 0.15 ? (level - 0.15) * 1.5 : 0;
            set("Brow_Raise_Inner_L", Math.min(browLift + 0.1, 0.6), 0.15);
            set("Brow_Raise_Inner_R", Math.min(browLift + 0.1, 0.6), 0.15);

            // Levantar cejas externas en énfasis fuerte
            if (level > 0.5) {
                set("Brow_Raise_Outer_L", (level - 0.5) * 1.2, 0.2);
                set("Brow_Raise_Outer_R", (level - 0.5) * 1.2, 0.2);
            } else {
                set("Brow_Raise_Outer_L", 0, 0.15);
                set("Brow_Raise_Outer_R", 0, 0.15);
            }

            // Micro-movimientos de cejas idle
            const browIdle = Math.sin(t * 0.7) * 0.05;
            set("Brow_Compress_L", browIdle > 0 ? browIdle : 0, 0.1);
            set("Brow_Compress_R", browIdle > 0 ? browIdle : 0, 0.1);

            // =====================================================
            // 4. MOVIMIENTO DE OJOS (Índices 17-24)
            // =====================================================
            // Saccades: miradas rápidas ocasionales
            const saccadeX = Math.sin(t * 0.3) > 0.95 ? Math.sin(t * 8) * 0.15 : 0;
            const saccadeY = Math.sin(t * 0.25) > 0.97 ? 0.1 : 0;

            if (saccadeX > 0) {
                set("Eye_L_Look_R", saccadeX, 0.15);
                set("Eye_R_Look_R", saccadeX, 0.15);
                set("Eye_L_Look_L", 0, 0.15);
                set("Eye_R_Look_L", 0, 0.15);
            } else if (saccadeX < 0) {
                set("Eye_L_Look_L", -saccadeX, 0.15);
                set("Eye_R_Look_L", -saccadeX, 0.15);
                set("Eye_L_Look_R", 0, 0.15);
                set("Eye_R_Look_R", 0, 0.15);
            } else {
                set("Eye_L_Look_L", 0, 0.1);
                set("Eye_R_Look_L", 0, 0.1);
                set("Eye_L_Look_R", 0, 0.1);
                set("Eye_R_Look_R", 0, 0.1);
            }

            set("Eye_L_Look_Up", saccadeY, 0.1);
            set("Eye_R_Look_Up", saccadeY, 0.1);

            // =====================================================
            // 5. MEJILLAS Y NARIZ (Índices 27-45)
            // =====================================================
            // Sonrisa genuina (Duchenne): Eye_Squint + Cheek_Raise - MUY REDUCIDO
            const isSmiling = mouthWide > 0.5 || level > 0.6; // Umbral más alto
            const smileFactor = isSmiling ? 0.2 : 0; // Intensidad reducida

            set("Cheek_Raise_L", smileFactor, 0.2);
            set("Cheek_Raise_R", smileFactor, 0.2);
            set("Eye_Squint_L", smileFactor * 0.4, 0.2);
            set("Eye_Squint_R", smileFactor * 0.4, 0.2);

            // Respiración nasal sutil
            const noseBreath = Math.sin(t * 1.5) * 0.15 + 0.1;
            set("Nose_Nostril_Dilate_L", noseBreath, 0.1);
            set("Nose_Nostril_Dilate_R", noseBreath, 0.1);

            // =====================================================
            // 6. MICRO-EXPRESIONES ALEATORIAS (Humanidad)
            // =====================================================
            // Pequeños gestos ocasionales
            const microTime = Math.sin(t * 0.4);

            if (microTime > 0.92) {
                // Leve tensión de labios
                set("Mouth_Tighten_L", 0.15, 0.1);
                set("Mouth_Tighten_R", 0.15, 0.1);
            } else {
                set("Mouth_Tighten_L", 0, 0.1);
                set("Mouth_Tighten_R", 0, 0.1);
            }

            if (microTime < -0.9) {
                // Leve fruncimiento de nariz
                set("Nose_Sneer_L", 0.1, 0.1);
                set("Nose_Sneer_R", 0.1, 0.1);
            } else {
                set("Nose_Sneer_L", 0, 0.1);
                set("Nose_Sneer_R", 0, 0.1);
            }
        }
    }
    );

    return (
        <group ref={group} position={[0, -5, 0]} scale={3}>
            <primitive object={scene} />
        </group>
    );
}

useGLTF.preload('/avatar.glb');
