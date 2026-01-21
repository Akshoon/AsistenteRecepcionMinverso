import { Component } from 'react';

class WebGLErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        // Check if it's a WebGL context error
        if (error?.message?.includes('WebGL')) {
            return { hasError: true, error };
        }
        return null;
    }

    componentDidCatch(error, errorInfo) {
        console.error('WebGL Error caught:', error, errorInfo);
    }

    handleReload = () => {
        window.location.reload();
    };

    render() {
        if (this.state.hasError) {
            return (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
                    color: 'white',
                    fontFamily: 'system-ui, -apple-system, sans-serif',
                    zIndex: 9999
                }}>
                    <div style={{
                        background: 'rgba(255,255,255,0.1)',
                        backdropFilter: 'blur(10px)',
                        padding: '40px',
                        borderRadius: '20px',
                        maxWidth: '500px',
                        textAlign: 'center',
                        border: '1px solid rgba(255,255,255,0.2)'
                    }}>
                        <div style={{ fontSize: '64px', marginBottom: '20px' }}>⚠️</div>
                        <h2 style={{ margin: '0 0 20px 0', fontSize: '24px' }}>Optimización de Recursos</h2>
                        <p style={{ margin: '0 0 30px 0', lineHeight: '1.6', opacity: 0.9 }}>
                            El navegador agotó los recursos de video de la VM (Software Rendering).
                            He simplificado los gráficos para evitar esto, pulsa recargar para aplicar los cambios.
                        </p>
                        <button
                            onClick={this.handleReload}
                            style={{
                                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                color: 'white',
                                border: 'none',
                                padding: '15px 40px',
                                fontSize: '16px',
                                borderRadius: '10px',
                                cursor: 'pointer',
                                fontWeight: 'bold',
                                boxShadow: '0 4px 15px rgba(102, 126, 234, 0.4)',
                                transition: 'transform 0.2s, box-shadow 0.2s'
                            }}
                            onMouseEnter={(e) => {
                                e.target.style.transform = 'translateY(-2px)';
                                e.target.style.boxShadow = '0 6px 20px rgba(102, 126, 234, 0.6)';
                            }}
                            onMouseLeave={(e) => {
                                e.target.style.transform = 'translateY(0)';
                                e.target.style.boxShadow = '0 4px 15px rgba(102, 126, 234, 0.4)';
                            }}
                        >
                            🔄 Recargar Página
                        </button>
                        <p style={{
                            marginTop: '30px',
                            fontSize: '12px',
                            opacity: 0.6,
                            lineHeight: '1.5'
                        }}>
                            Tip: Para evitar esto en desarrollo, evita hacer cambios muy rápidos<br />
                            que causen múltiples recargas del Canvas 3D.
                        </p>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default WebGLErrorBoundary;
