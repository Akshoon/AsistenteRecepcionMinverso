import { useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useGLTF, useFBX, useAnimations } from '@react-three/drei';
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

    // Log Position
    useEffect(() => {
        if (group.current) {
            console.log("📍 Personaje Position:", group.current.position);
        }
    }, []);

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

    // === IDLE ANIMATION & RETARGETING ===
    const { animations: idleAnimation } = useGLTF('/animations/IdleGLB.glb');
    const { actions } = useAnimations(idleAnimation, group);

    useEffect(() => {
        if (!idleAnimation || !idleAnimation[0] || !scene) return;

        const clip = idleAnimation[0];

        // 1. Identify Model Prefix
        // Find the first bone that looks like a hip to determine the model's naming convention
        let modelPrefix = "";
        scene.traverse((obj) => {
            if (obj.isBone && !modelPrefix) {
                if (obj.name.includes("mixamorig")) {
                    modelPrefix = "mixamorig";
                } else if (obj.name.includes("mixamorig:")) {
                    modelPrefix = "mixamorig:";
                }
            }
        });

        // 2. Retarget Tracks
        clip.tracks.forEach((track) => {
            // THREE.js track names are "BoneName.property"
            // We need to fix the BoneName part
            let [trackBone, trackProp] = track.name.split('.');

            // Clean track bone name (remove mixamorig prefix from animation if present)
            let cleanBoneName = trackBone.replace(/mixamorig:?/i, "");

            // Re-apply correct prefix for the model
            let finalBoneName = modelPrefix ? `${modelPrefix}:${cleanBoneName}` : cleanBoneName;

            // Special case: "Hips" often needs exact matching
            if (cleanBoneName.toLowerCase() === "hips") {
                // Try to find the actual hips bone in scene to be sure
                // (Simpler: just use the constructed name)
            }

            // Update track name
            // Note: In some THREE versions track.name is read-only, but usually it's editable.
            // If strictly read-only, we'd need to clone the track. For now, try direct mutation.
            track.name = `${finalBoneName}.${trackProp}`;
        });

        // 3. Filter Tracks (Hips, Neck, Head, Eyes, Jaw)
        // We filter AFTER renaming so we look for the *corrected* names
        clip.tracks = clip.tracks.filter((track) => {
            const trackName = track.name.toLowerCase();

            // Filter out Hips to keep avatar upright
            if (trackName.includes("hips")) return false;

            // Filter out Neck/Head to keep head stable for lip-sync/lookAt
            if (trackName.includes("neck") || trackName.includes("head")) return false;

            // Filter out Eyes to prevent "cross-eyed" or wandering eyes from animation
            if (trackName.includes("eye")) return false;

            // Filter out Jaw to prevent conflict with LipSync
            if (trackName.includes("jaw") || trackName.includes("teeth") || trackName.includes("tongue")) return false;

            return true;
        });

        // Reset and play
        if (actions && actions[clip.name]) {
            actions[clip.name].reset().fadeIn(0.5).play();
        }

    }, [idleAnimation, scene, actions]);

    // FPS Capping for Mobile (30 FPS)
    const frameTimeRef = useRef(0);

    useFrame((_, delta) => {
        // Limit to 30 FPS on mobile to save battery and reduce CPU heat
        if (isMobile) {
            frameTimeRef.current += delta;
            if (frameTimeRef.current < 1 / 30) return;
            frameTimeRef.current = 0;
        }
    });

    return (
        <group ref={group} position={[0, -4.5, 0]} scale={3} rotation={[0, Math.PI / -3, 0]}>
            <primitive object={scene} />
        </group>
    );
}