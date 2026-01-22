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
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

export default function Avatar3D({
    audioStream = null,
    emotionState = 'neutral',
    modelPath = '/avatar.glb',
    // Legacy props kept for compatibility
    audioLevel = 0,
    lipSyncData = null,
    audioFeatures = null
}) {
    const group = useRef();
    const { scene } = useGLTF(modelPath);
    const { gl } = useThree();

    // === NEW HOOK IMPLEMENTATION ===
    useGeminiLipSync({
        scene,
        audioStream,
        currentEmotion: emotionState
    });

    // === UTILITIES ===
    useEffect(() => {
        if (!scene) return;
        // Simplify materials for performance
        scene.traverse((child) => {
            if (child.isMesh && child.material) {
                child.material.envMapIntensity = isMobile ? 0.25 : 0.5;
                child.material.needsUpdate = true;
            }
        });
    }, [scene]);

    // Handle WebGL Context Loss
    useEffect(() => {
        const canvas = gl.domElement;
        const handleContextLost = (e) => { e.preventDefault(); console.warn('WebGL Context Lost'); };
        const handleContextRestored = () => console.log('WebGL Context Restored');

        canvas.addEventListener('webglcontextlost', handleContextLost);
        canvas.addEventListener('webglcontextrestored', handleContextRestored);
        return () => {
            canvas.removeEventListener('webglcontextlost', handleContextLost);
            canvas.removeEventListener('webglcontextrestored', handleContextRestored);
        };
    }, [gl]);

    // === IDLE ANIMATION (ARMS/BODY ONLY) ===
    const bonesRef = useRef({
        lArm: null, rArm: null, lFore: null, rFore: null
    });

    useEffect(() => {
        if (!scene) return;
        bonesRef.current = {
            lArm: scene.getObjectByName('CC_Base_L_Upperarm'),
            rArm: scene.getObjectByName('CC_Base_R_Upperarm'),
            lFore: scene.getObjectByName('CC_Base_L_Forearm'),
            rFore: scene.getObjectByName('CC_Base_R_Forearm')
        };
    }, [scene]);

    // FPS Capping for Mobile (30 FPS)
    const frameTimeRef = useRef(0);

    useFrame((_, delta) => {
        // Limit to 30 FPS on mobile to save battery and reduce CPU heat
        if (isMobile) {
            frameTimeRef.current += delta;
            if (frameTimeRef.current < 1 / 30) return;
            frameTimeRef.current = 0;
        }

        const { lArm, rArm, lFore, rFore } = bonesRef.current;

        if (lArm) { lArm.rotation.z = -1.4; lArm.rotation.x = 0; lArm.rotation.y = 0; }
        if (rArm) { rArm.rotation.z = 1.4; rArm.rotation.x = 0; rArm.rotation.y = 0; }
        if (lFore) { lFore.rotation.z = 0.1; lFore.rotation.x = 0.2; }
        if (rFore) { rFore.rotation.z = -0.1; rFore.rotation.x = 0.2; }
    });

    return (
        <group ref={group} position={[0, -5, 0]} scale={3}>
            <primitive object={scene} />
        </group>
    );
}
