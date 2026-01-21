import { useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import useGeminiLipSync from '../hooks/useGeminiLipSync';

/**
 * Avatar3D Component - 3D Avatar with Spanish Real-Time Lip-Sync
 * 
 * Uses jaw BONE rotation for natural teeth movement via skinning.
 * Morph targets coordinate with jaw rotation for refined lip shapes.
 * 
 * SPEC COMPLIANCE:
 * - Jaw bone animated via rotation.x ∈ [0.0, 0.48] (STRICT LIMIT)
 * - Jaw_Open morph NEVER exceeds 0.5
 * - Teeth and tongue follow jaw via skinning (NOT animated directly)
 * - Morphs refine shape only, jaw is primary driver
 * - 20ms lookahead for reduced perceived latency
 * 
 * @param {Object} props
 * @param {number} props.audioLevel - Legacy audio level (0-1)
 * @param {Object} props.lipSyncData - Legacy lip-sync data
 * @param {Object} props.audioFeatures - New audio features { rms, low, mid, high, zcr }
 * @param {string} props.emotionState - Emotion: "neutral" | "happy" | "sad" | "angry" | "surprised"
 */
export default function Avatar3D({
    audioLevel = 0,
    lipSyncData = null,
    audioFeatures = null,
    emotionState = 'neutral'
}) {
    const group = useRef();
    const { scene } = useGLTF('/avatar.glb');

    const morphMeshes = useRef([]);
    const bonesRef = useRef({});
    const jawBoneRef = useRef(null);
    const timeRef = useRef(0);

    const { gl } = useThree();

    // Initialize the Gemini lip-sync hook
    const { update: updateLipSync, reset: resetLipSync, JAW_ROTATION_MAX } = useGeminiLipSync();

    // Initialize morphs, bones, and find jaw bone
    useEffect(() => {
        morphMeshes.current = [];
        bonesRef.current = {};
        jawBoneRef.current = null;

        // Jaw bone name patterns to search for
        const JAW_BONE_NAMES = ['CC_Base_JawRoot', 'CC_Base_Jaw', 'JawRoot', 'Jaw', 'jaw'];

        scene.traverse((child) => {
            if (child.isMesh && child.morphTargetDictionary && child.morphTargetInfluences) {
                morphMeshes.current.push(child);

                // Log morph targets for debugging
                if (child.name === 'CC_Base_Body001' || child.name.includes('Head')) {
                    console.log(`📋 Morph targets in ${child.name}:`, Object.keys(child.morphTargetDictionary).slice(0, 20));
                }
            }

            if (child.isBone) {
                bonesRef.current[child.name] = child;

                // Find jaw bone
                if (JAW_BONE_NAMES.some(pattern => child.name.includes(pattern) || child.name === pattern)) {
                    if (!jawBoneRef.current) {
                        jawBoneRef.current = child;
                        console.log(`🦴 Jaw bone found: ${child.name}`);
                    }
                }
            }

            // Simplify materials to prevent shader errors on non-GPU instances
            if (child.isMesh && child.material) {
                // Convert to simpler material if it's high-end
                if (child.material.type === 'MeshPhysicalMaterial') {
                    const oldMat = child.material;
                    const newMat = new THREE.MeshStandardMaterial({
                        map: oldMat.map,
                        normalMap: oldMat.normalMap,
                        roughnessMap: oldMat.roughnessMap,
                        metalnessMap: oldMat.metalnessMap,
                        aoMap: oldMat.aoMap,
                        color: oldMat.color,
                        roughness: 0.8,
                        metalness: 0,
                        transparent: oldMat.transparent,
                        opacity: oldMat.opacity,
                        skinning: true
                    });
                    child.material = newMat;
                    oldMat.dispose();
                } else {
                    // Stripping costy features from existing materials
                    child.material.envMapIntensity = 0.5;
                    child.material.needsUpdate = true;
                }
            }
        });

        // Find arm bones for posture
        const armBones = ['CC_Base_L_Upperarm', 'CC_Base_R_Upperarm', 'CC_Base_L_Forearm', 'CC_Base_R_Forearm'];
        const foundBones = {};
        armBones.forEach(name => {
            if (bonesRef.current[name]) {
                foundBones[name] = bonesRef.current[name];
            }
        });
        bonesRef.current.found = foundBones;

        // Log all bones if jaw not found
        if (!jawBoneRef.current) {
            console.warn('⚠️ Jaw bone not found! Available bones:', Object.keys(bonesRef.current).filter(n => n.toLowerCase().includes('jaw') || n.toLowerCase().includes('head')));
        }

        console.log('✅ Avatar initialized with jaw bone animation support');

    }, [scene]);

    // Handle WebGL context loss
    useEffect(() => {
        const canvas = gl.domElement;

        const handleContextLost = (event) => {
            event.preventDefault();
            console.warn('⚠️ WebGL context lost - will attempt automatic restore');
        };

        const handleContextRestored = () => {
            console.log('✅ WebGL context restored');
        };

        canvas.addEventListener('webglcontextlost', handleContextLost);
        canvas.addEventListener('webglcontextrestored', handleContextRestored);

        return () => {
            canvas.removeEventListener('webglcontextlost', handleContextLost);
            canvas.removeEventListener('webglcontextrestored', handleContextRestored);
        };
    }, [gl, scene]);

    // Main animation loop
    useFrame((state, delta) => {
        timeRef.current += delta;
        const t = timeRef.current;

        // === ARM POSTURE ===
        const found = bonesRef.current.found || {};
        const lArm = found['CC_Base_L_Upperarm'];
        const rArm = found['CC_Base_R_Upperarm'];
        const lFore = found['CC_Base_L_Forearm'];
        const rFore = found['CC_Base_R_Forearm'];

        if (lArm) { lArm.rotation.z = -1.4; lArm.rotation.x = 0; lArm.rotation.y = 0; }
        if (rArm) { rArm.rotation.z = 1.4; rArm.rotation.x = 0; rArm.rotation.y = 0; }
        if (lFore) { lFore.rotation.z = 0.1; lFore.rotation.x = 0.2; }
        if (rFore) { rFore.rotation.z = -0.1; rFore.rotation.x = 0.2; }

        // === GEMINI LIP-SYNC (NEW HOOK) ===
        // Convert legacy lipSyncData/audioLevel to audioFeatures if needed
        let features = audioFeatures;

        if (!features && (lipSyncData || audioLevel > 0.02)) {
            // Fallback: create features from legacy data
            const rms = lipSyncData?.jaw || audioLevel || 0;
            features = {
                rms,
                low: rms * 0.4,
                mid: rms * 0.4,
                high: rms * 0.2,
                zcr: lipSyncData?.isActive ? 0.15 : 0.05,
            };
        }

        // Update lip-sync via hook (handles jaw bone + all morphs + emotions)
        if (features || lipSyncData || audioLevel > 0.02) {
            updateLipSync(
                jawBoneRef.current,
                morphMeshes.current,
                features,
                emotionState
            );
        }

        // === BLINKING (independent of lip-sync) ===
        for (const mesh of morphMeshes.current) {
            const dict = mesh.morphTargetDictionary;
            const inf = mesh.morphTargetInfluences;
            if (!dict || !inf) continue;

            const meshName = mesh.name;
            const isFaceMesh = meshName === 'CC_Base_Body001' ||
                meshName.includes('Head') ||
                meshName.includes('Face');

            if (isFaceMesh) {
                // Optimized blink logic (only calculate once per mesh set)
                const blinkCycle = t % 4;
                let blink = 0;
                if (blinkCycle > 3.7 && blinkCycle < 3.9) {
                    blink = Math.sin((blinkCycle - 3.7) / 0.2 * Math.PI);
                } else if (Math.random() < 0.001) { // Reduced random blink frequency
                    blink = 0.7;
                }

                if (dict["Eye_Blink_L"] !== undefined) {
                    inf[dict["Eye_Blink_L"]] = THREE.MathUtils.lerp(inf[dict["Eye_Blink_L"]], blink, 0.5);
                    inf[dict["Eye_Blink_R"]] = THREE.MathUtils.lerp(inf[dict["Eye_Blink_R"]], blink, 0.5);
                }
            }
        }
    });

    return (
        <group ref={group} position={[0, -5, 0]} scale={3}>
            <primitive object={scene} />
        </group>
    );
}

useGLTF.preload('/avatar.glb');
