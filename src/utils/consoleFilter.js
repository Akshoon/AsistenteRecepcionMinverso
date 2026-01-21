// Suppress THREE.js shader validation warnings in development
// These are non-critical and flood the console during WebGL context issues

const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

console.error = function (...args) {
    const message = args[0]?.toString() || '';

    // Suppress shader validation errors - they're non-critical
    if (message.includes('WebGLProgram') ||
        message.includes('Shader Error') ||
        message.includes('VALIDATE_STATUS')) {
        return;
    }

    originalConsoleError.apply(console, args);
};

console.warn = function (...args) {
    const message = args[0]?.toString() || '';

    // Suppress WebGL context warnings - we handle these gracefully
    if (message.includes('CONTEXT_LOST_WEBGL') ||
        message.includes('WEBGL_lose_context') ||
        message.includes('INVALID_OPERATION: useProgram')) {
        return;
    }

    originalConsoleWarn.apply(console, args);
};

export { originalConsoleError, originalConsoleWarn };
