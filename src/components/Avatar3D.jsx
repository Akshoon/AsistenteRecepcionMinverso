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
    audioStream = null, // New Prop: MediaStream
    emotionState = 'neutral',
    // Legacy props kept for compatibility but unused by new hook
    audioLevel = 0,
    lipSyncData = null,
    audioFeatures = null
}) {
    const group = useRef();
    const { scene } = useGLTF('/avatar.glb');
    const { gl } = useThree();

    // === NEW HOOK IMPLEMENTATION ===
    // Handles all lip-sync, jaw physics, morphs, and blinking internally
    useGeminiLipSync({
        scene,
        audioStream,
        currentEmotion: emotionState
    });

    // === UTILITIES ===
    useEffect(() => {
        // Simplify materials for performance
        scene.traverse((child) => {
            if (child.isMesh && child.material) {
                child.material.envMapIntensity = 0.5;
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
    // Lip-sync and Face are handled by the hook. Here we handle body posture.
    useFrame((state) => {
        const t = state.clock.getElapsedTime();

        // Arm Posture (Static/Idle)
        // We find bones manually here since refs are inside the hook now, 
        // or we could traverse once. For safety/speed we traverse if needed or cache.
        // For strictly keeping it simple:
        const lArm = scene.getObjectByName('CC_Base_L_Upperarm');
        const rArm = scene.getObjectByName('CC_Base_R_Upperarm');
        const lFore = scene.getObjectByName('CC_Base_L_Forearm');
        const rFore = scene.getObjectByName('CC_Base_R_Forearm');

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

useGLTF.preload('/avatar.glb');
