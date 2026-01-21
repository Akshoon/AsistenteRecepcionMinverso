import { useRef, useEffect, useCallback, useState } from 'react';
import { SpanishVisemeResolver, SPANISH_VISEMES, getMorphTargets } from '../utils/SpanishVisemeResolver';

/**
 * useGeminiSpanishLipSync - React Hook for Real-Time Spanish Lip-Sync
 * 
 * Provides viseme/jaw data from AudioWorklet for React Three Fiber animation.
 * The AudioWorklet should be created externally and passed via setWorkletNode.
 * 
 * @returns {Object} - { lipSyncState, setWorkletNode, reset, isActive }
 */
export default function useGeminiSpanishLipSync() {
    const resolverRef = useRef(new SpanishVisemeResolver());
    const workletNodeRef = useRef(null);
    const messageHandlerRef = useRef(null);

    const [lipSyncState, setLipSyncState] = useState({
        viseme: 'REST',
        weights: {},
        jaw: 0,
        isActive: false
    });

    /**
     * Set the AudioWorklet node and attach message handler
     */
    const setWorkletNode = useCallback((workletNode) => {
        // Clean up previous handler
        if (workletNodeRef.current && messageHandlerRef.current) {
            workletNodeRef.current.port.onmessage = null;
        }

        workletNodeRef.current = workletNode;

        if (workletNode) {
            // Attach message handler
            messageHandlerRef.current = (event) => {
                const { rms, zcr, timestamp } = event.data;

                // Resolve viseme using Spanish resolver
                const state = resolverRef.current.resolve(rms, zcr, timestamp);
                setLipSyncState(state);
            };

            workletNode.port.onmessage = messageHandlerRef.current;
            console.log('🎤 Lip-sync message handler attached to worklet');
        }
    }, []);

    /**
     * Reset lip-sync state
     */
    const reset = useCallback(() => {
        resolverRef.current.reset();
        setLipSyncState({
            viseme: 'REST',
            weights: {},
            jaw: 0,
            isActive: false
        });
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (workletNodeRef.current && messageHandlerRef.current) {
                workletNodeRef.current.port.onmessage = null;
            }
        };
    }, []);

    return {
        lipSyncState,
        setWorkletNode,
        reset,
        isActive: lipSyncState.isActive,
        SPANISH_VISEMES,
        getMorphTargets
    };
}
