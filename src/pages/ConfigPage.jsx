import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import './ConfigPage.css';
import './ConfigPage_Documents.css';
import './ConfigPage_Groups.css';
import './ConfigPage_IoTServices.css';

const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

function ConfigPage() {
    const [activeTab, setActiveTab] = useState('iot');
    const [config, setConfig] = useState(null);
    const [phones, setPhones] = useState({});
    const [integrations, setIntegrations] = useState(null);
    const [servicesStatus, setServicesStatus] = useState([]);
    const [documents, setDocuments] = useState([]);
    const [editingDoc, setEditingDoc] = useState(null);
    const [editContent, setEditContent] = useState('');
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const [successMessage, setSuccessMessage] = useState('');
    const [expandedServices, setExpandedServices] = useState({});
    const [availableSerialPorts, setAvailableSerialPorts] = useState([]);
    const [availableCameras, setAvailableCameras] = useState([]);

    // AI Analysis State
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analysisResult, setAnalysisResult] = useState(null);

    useEffect(() => {
        loadAllData();
    }, []);

    const loadAllData = async () => {
        try {
            setLoading(true);
            setError(null);

            const [instructionsRes, phonesRes, integrationsRes, servicesRes, docsRes, serialPortsRes, camerasRes] = await Promise.all([
                fetch('/api/config/instructions'),
                fetch('/api/config/phones'),
                fetch('/api/config/integrations'),
                fetch('/api/services/status'),
                fetch('/api/config/documents'),
                fetch('/api/devices/serial-ports'),
                fetch('/api/devices/cameras')
            ]);

            if (instructionsRes.ok) setConfig(await instructionsRes.json());
            if (phonesRes.ok) setPhones(await phonesRes.json());
            if (integrationsRes.ok) setIntegrations(await integrationsRes.json());
            if (servicesRes.ok) setServicesStatus(await servicesRes.json());
            if (docsRes.ok) setDocuments(await docsRes.json());
            if (serialPortsRes.ok) setAvailableSerialPorts(await serialPortsRes.json());
            if (camerasRes.ok) setAvailableCameras(await camerasRes.json());
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveAll = async () => {
        try {
            setSaving(true);
            setError(null);
            setSuccessMessage('');

            const results = await Promise.all([
                fetch('/api/config/instructions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(config)
                }),
                fetch('/api/config/phones', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(phones)
                }),
                fetch('/api/config/integrations', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(integrations)
                })
            ]);

            if (results.every(r => r.ok)) {
                setSuccessMessage('Configuracion guardada');
                setTimeout(() => setSuccessMessage(''), 3000);
            } else {
                throw new Error('Error guardando');
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleEditDocument = async (doc) => {
        setEditingDoc(doc.name);
        setEditContent('Cargando contenido...');

        try {
            const res = await fetch(`/api/config/documents/${doc.name}`);
            if (res.ok) {
                const data = await res.json();
                setEditContent(data.content || '');
            } else {
                setEditContent('Error cargando contenido.');
                setError('No se pudo cargar el contenido del documento');
            }
        } catch (err) {
            setEditContent('Error de conexión.');
            setError(err.message);
        }
    };

    const handleSaveDocument = async () => {
        if (!editingDoc) return;

        try {
            setSaving(true);
            const res = await fetch(`/api/config/documents/${editingDoc}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'text/plain' },
                body: editContent
            });

            if (res.ok) {
                setSuccessMessage(`${editingDoc} guardado`);
                setEditingDoc(null);
                loadAllData();
                setTimeout(() => setSuccessMessage(''), 2000);
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleUploadDocument = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('document', file);

        try {
            const res = await fetch('/api/config/documents', {
                method: 'POST',
                body: formData
            });
            if (res.ok) {
                setSuccessMessage(`${file.name} subido`);
                loadAllData();
            }
        } catch (err) {
            setError(err.message);
        }
    };

    const handleDeleteDocument = async (filename) => {
        if (!confirm(`Eliminar ${filename}?`)) return;
        try {
            const res = await fetch(`/api/config/documents/${filename}`, { method: 'DELETE' });
            if (res.ok) {
                setSuccessMessage(`${filename} eliminado`);
                loadAllData();
            }
        } catch (err) {
            setError(err.message);
        }
    };

    const handleAnalyzeDocuments = async () => {
        setIsAnalyzing(true);
        setAnalysisResult(null);
        setError(null);

        try {
            const res = await fetch('/api/config/documents/analyze', { method: 'POST' });
            const data = await res.json();

            if (res.ok) {
                setAnalysisResult(data.result);
            } else {
                setError(data.error || 'Error analizando documentos');
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleSummarizeDocuments = async () => {
        setIsAnalyzing(true);
        setAnalysisResult(null);
        setError(null);

        try {
            const res = await fetch('/api/config/documents/summarize', { method: 'POST' });
            const data = await res.json();

            if (res.ok) {
                setAnalysisResult(data.result);
            } else {
                setError(data.error || 'Error resumiendo documentos');
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setIsAnalyzing(false);
        }
    };

    // IoT functions (from original)
    const getIotDevices = () => {
        if (!config?.comandos?.commands) return [];
        const devices = new Map();

        config.comandos.commands.forEach((cmd, idx) => {
            if (cmd.id.startsWith('grupo_') || cmd.isGroup) return;
            const match = cmd.id.match(/^(.+?)_(on|off)$/);
            if (match) {
                const deviceId = match[1];
                const action = match[2];
                if (!devices.has(deviceId)) {
                    devices.set(deviceId, {
                        id: deviceId,
                        name: deviceId,
                        onIdx: null,
                        offIdx: null,
                        onUrl: '',
                        offUrl: '',
                        triggers: []
                    });
                }
                const device = devices.get(deviceId);
                if (action === 'on') {
                    device.onIdx = idx;
                    device.onUrl = cmd.args?.url || '';
                    device.triggers = [...device.triggers, ...cmd.triggers];
                } else {
                    device.offIdx = idx;
                    device.offUrl = cmd.args?.url || '';
                    device.triggers = [...device.triggers, ...cmd.triggers];
                }
            }
        });

        return Array.from(devices.values());
    };

    const executeIoTAction = async (url) => {
        try {
            const res = await fetch('/api/iot/action', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url })
            });

            const data = await res.json();

            if (data.success) {
                setSuccessMessage('Accion ejecutada correctamente');
                setTimeout(() => setSuccessMessage(''), 2000);
            } else {
                throw new Error(data.error || 'Error desconocido del servidor');
            }
        } catch (err) {
            console.warn('Proxy falló, intentando acceso directo...', err);
            try {
                // Intento directo desde el navegador (puede fallar por CORS/Mixed Content)
                await fetch(url, { mode: 'no-cors' });
                setSuccessMessage('Accion ejecutada (Modo Directo)');
                setTimeout(() => setSuccessMessage(''), 2000);
            } catch (e) {
                setError(`Error de conexión: ${err.message}`);
            }
        }
    };

    const addIoTDevice = () => {
        const deviceName = prompt('Nombre del dispositivo (sin espacios):');
        if (!deviceName) return;
        const cleanName = deviceName.toLowerCase().replace(/\s+/g, '_');

        const c = { ...config };
        c.comandos.commands.push({
            id: `${cleanName}_on`,
            triggers: [`prende ${deviceName}`, `enciende ${deviceName}`],
            tool: 'visit_url',
            args: { url: 'http://192.168.1.X/action=on' },
            response: `${deviceName} encendido.`
        });
        c.comandos.commands.push({
            id: `${cleanName}_off`,
            triggers: [`apaga ${deviceName}`, `desactiva ${deviceName}`],
            tool: 'visit_url',
            args: { url: 'http://192.168.1.X/action=off' },
            response: `${deviceName} apagado.`
        });
        setConfig(c);
        setSuccessMessage(`Dispositivo ${deviceName} agregado`);
        setTimeout(() => setSuccessMessage(''), 2000);
    };

    const deleteIoTDevice = (deviceId) => {
        if (!confirm(`Eliminar dispositivo ${deviceId}?`)) return;
        const c = { ...config };
        c.comandos.commands = c.comandos.commands.filter(
            cmd => !cmd.id.startsWith(`${deviceId}_`)
        );
        setConfig(c);
    };

    const renameIoTDevice = (oldId, newId) => {
        if (oldId === newId || !newId) return;
        const cleanId = newId.toLowerCase().replace(/\s+/g, '_');
        const c = { ...config };
        c.comandos.commands.forEach(cmd => {
            if (cmd.id === `${oldId}_on`) {
                cmd.id = `${cleanId}_on`;
                cmd.triggers = cmd.triggers.map(t => t.replace(oldId, newId));
                cmd.response = cmd.response.replace(oldId, newId);
            } else if (cmd.id === `${oldId}_off`) {
                cmd.id = `${cleanId}_off`;
                cmd.triggers = cmd.triggers.map(t => t.replace(oldId, newId));
                cmd.response = cmd.response.replace(oldId, newId);
            }
        });
        setConfig(c);
    };

    const updateDeviceUrl = (deviceId, action, newUrl) => {
        const c = { ...config };
        const cmdId = `${deviceId}_${action}`;
        const cmd = c.comandos.commands.find(x => x.id === cmdId);
        if (cmd) cmd.args.url = newUrl;
        setConfig(c);
    };

    const toggleIntegration = async (key, enabled) => {
        const newIntegrations = { ...integrations };
        if (!newIntegrations[key]) {
            newIntegrations[key] = {};
        }
        newIntegrations[key].enabled = enabled;
        setIntegrations(newIntegrations);

        try {
            await fetch('/api/config/integrations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newIntegrations)
            });
        } catch (error) {
            console.error('Error saving integrations:', error);
        }
    };

    const updatePhoneNumber = (name, val) => setPhones({ ...phones, [name]: val });
    const updatePhoneName = (old, newName) => {
        if (old === newName) return;
        const p = { ...phones };
        p[newName] = p[old];
        delete p[old];
        setPhones(p);
    };
    const deleteContact = (name) => {
        if (!confirm('Eliminar?')) return;
        const p = { ...phones };
        delete p[name];
        setPhones(p);
    };
    const addContact = () => setPhones({ ...phones, [`Contacto_${Date.now()}`]: '' });

    if (loading) {
        return <div className="config-page"><div className="loading">Cargando...</div></div>;
    }

    const tabs = [
        { id: 'iot', label: 'Dispositivos IoT' },
        { id: 'services', label: 'Servicios' },
        { id: 'integrations', label: 'Integraciones' },
        { id: 'whatsapp', label: 'WhatsApp' },
        { id: 'documents', label: 'Documentos' }
    ];

    const iotDevices = getIotDevices();

    const navSections = [
        {
            title: 'Principal',
            items: [
                { id: 'documents', label: 'Documentos' },
                { id: 'iot', label: 'Dispositivos IoT' },
                { id: 'iot-services', label: 'Servicios IoT' }
            ]
        },
        {
            title: 'Configuracion',
            items: [
                { id: 'integrations', label: 'Integraciones' },
                { id: 'whatsapp', label: 'WhatsApp' },
                { id: 'services', label: 'Servicios' }
            ]
        }
    ];

    return (
        <div className="config-page">
            {/* Sidebar */}
            <aside className={`config-sidebar ${sidebarOpen ? 'open' : ''}`}>
                <div className="sidebar-header">
                    <div className="sidebar-logo">
                        <div className="sidebar-logo-icon">
                            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M12 15C13.6569 15 15 13.6569 15 12C15 10.3431 13.6569 9 12 9C10.3431 9 9 10.3431 9 12C9 13.6569 10.3431 15 12 15Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                <path d="M19.4 15C19.2669 15.3016 19.2272 15.6362 19.286 15.9606C19.3448 16.285 19.4995 16.5843 19.73 16.82L19.79 16.88C19.976 17.0657 20.1235 17.2863 20.2241 17.5291C20.3248 17.7719 20.3766 18.0322 20.3766 18.295C20.3766 18.5578 20.3248 18.8181 20.2241 19.0609C20.1235 19.3037 19.976 19.5243 19.79 19.71C19.6043 19.896 19.3837 20.0435 19.1409 20.1441C18.8981 20.2448 18.6378 20.2966 18.375 20.2966C18.1122 20.2966 17.8519 20.2448 17.6091 20.1441C17.3663 20.0435 17.1457 19.896 16.96 19.71L16.9 19.65C16.6643 19.4195 16.365 19.2648 16.0406 19.206C15.7162 19.1472 15.3816 19.1869 15.08 19.32C14.7842 19.4468 14.532 19.6572 14.3543 19.9255C14.1766 20.1938 14.0813 20.5082 14.08 20.83V21C14.08 21.5304 13.8693 22.0391 13.4942 22.4142C13.1191 22.7893 12.6104 23 12.08 23C11.5496 23 11.0409 22.7893 10.6658 22.4142C10.2907 22.0391 10.08 21.5304 10.08 21V20.91C10.0723 20.579 9.96512 20.258 9.77251 19.9887C9.5799 19.7194 9.31074 19.5143 9 19.4C8.69838 19.2669 8.36381 19.2272 8.03941 19.286C7.71502 19.3448 7.41568 19.4995 7.18 19.73L7.12 19.79C6.93425 19.976 6.71368 20.1235 6.47088 20.2241C6.22808 20.3248 5.96783 20.3766 5.705 20.3766C5.44217 20.3766 5.18192 20.3248 4.93912 20.2241C4.69632 20.1235 4.47575 19.976 4.29 19.79C4.10405 19.6043 3.95653 19.3837 3.85588 19.1409C3.75523 18.8981 3.70343 18.6378 3.70343 18.375C3.70343 18.1122 3.75523 17.8519 3.85588 17.6091C3.95653 17.3663 4.10405 17.1457 4.29 16.96L4.35 16.9C4.58054 16.6643 4.73519 16.365 4.794 16.0406C4.85282 15.7162 4.81312 15.3816 4.68 15.08C4.55324 14.7842 4.34276 14.532 4.07447 14.3543C3.80618 14.1766 3.49179 14.0813 3.17 14.08H3C2.46957 14.08 1.96086 13.8693 1.58579 13.4942C1.21071 13.1191 1 12.6104 1 12.08C1 11.5496 1.21071 11.0409 1.58579 10.6658C1.96086 10.2907 2.46957 10.08 3 10.08H3.09C3.42099 10.0723 3.742 9.96512 4.0113 9.77251C4.28059 9.5799 4.48572 9.31074 4.6 9C4.73312 8.69838 4.77282 8.36381 4.714 8.03941C4.65519 7.71502 4.50054 7.41568 4.27 7.18L4.21 7.12C4.02405 6.93425 3.87653 6.71368 3.77588 6.47088C3.67523 6.22808 3.62343 5.96783 3.62343 5.705C3.62343 5.44217 3.67523 5.18192 3.77588 4.93912C3.87653 4.69632 4.02405 4.47575 4.21 4.29C4.39575 4.10405 4.61632 3.95653 4.85912 3.85588C5.10192 3.75523 5.36217 3.70343 5.625 3.70343C5.88783 3.70343 6.14808 3.75523 6.39088 3.85588C6.63368 3.95653 6.85425 4.10405 7.04 4.29L7.1 4.35C7.33568 4.58054 7.63502 4.73519 7.95941 4.794C8.28381 4.85282 8.61838 4.81312 8.92 4.68H9C9.29577 4.55324 9.54802 4.34276 9.72569 4.07447C9.90337 3.80618 9.99872 3.49179 10 3.17V3C10 2.46957 10.2107 1.96086 10.5858 1.58579C10.9609 1.21071 11.4696 1 12 1C12.5304 1 13.0391 1.21071 13.4142 1.58579C13.7893 1.96086 14 2.46957 14 3V3.09C14.0013 3.41179 14.0966 3.72618 14.2743 3.99447C14.452 4.26276 14.7042 4.47324 15 4.6C15.3016 4.73312 15.6362 4.77282 15.9606 4.714C16.285 4.65519 16.5843 4.50054 16.82 4.27L16.88 4.21C17.0657 4.02405 17.2863 3.87653 17.5291 3.77588C17.7719 3.67523 18.0322 3.62343 18.295 3.62343C18.5578 3.62343 18.8181 3.67523 19.0609 3.77588C19.3037 3.87653 19.5243 4.02405 19.71 4.21C19.896 4.39575 20.0435 4.61632 20.1441 4.85912C20.2448 5.10192 20.2966 5.36217 20.2966 5.625C20.2966 5.88783 20.2448 6.14808 20.1441 6.39088C20.0435 6.63368 19.896 6.85425 19.71 7.04L19.65 7.1C19.4195 7.33568 19.2648 7.63502 19.206 7.95941C19.1472 8.28381 19.1869 8.61838 19.32 8.92V9C19.4468 9.29577 19.6572 9.54802 19.9255 9.72569C20.1938 9.90337 20.5082 9.99872 20.83 10H21C21.5304 10 22.0391 10.2107 22.4142 10.5858C22.7893 10.9609 23 11.4696 23 12C23 12.5304 22.7893 13.0391 22.4142 13.4142C22.0391 13.7893 21.5304 14 21 14H20.91C20.5882 14.0013 20.2738 14.0966 20.0055 14.2743C19.7372 14.452 19.5268 14.7042 19.4 15Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        </div>
                        <span className="sidebar-logo-text">Config</span>
                    </div>
                    <button className="sidebar-toggle" onClick={() => setSidebarOpen(false)}>×</button>
                </div>

                <nav className="sidebar-nav">
                    {navSections.map(section => (
                        <div key={section.title} className="nav-section">
                            <div className="nav-section-title">{section.title}</div>
                            {section.items.map(item => (
                                <div
                                    key={item.id}
                                    className={`nav-item ${activeTab === item.id ? 'active' : ''}`}
                                    onClick={() => {
                                        setActiveTab(item.id);
                                        if (isMobile) setSidebarOpen(false);
                                    }}
                                >
                                    <span className="nav-item-icon">{item.icon}</span>
                                    <span className="nav-item-text">{item.label}</span>
                                </div>
                            ))}
                        </div>
                    ))}
                </nav>
            </aside>

            {/* Main Content */}
            <div className="config-main">
                <header className="config-header">
                    <div className="header-left">
                        <button className="mobile-menu-btn" onClick={() => setSidebarOpen(true)}>☰</button>
                        <h1 className="header-title">
                            {navSections.flatMap(s => s.items).find(i => i.id === activeTab)?.label || 'Configuracion'}
                        </h1>
                    </div>
                    <Link to="/" className="back-link">← Volver</Link>
                </header>

                <main className="config-content">{/* Content sections remain the same */}
                    {error && <div className="error-banner">{error}</div>}
                    {successMessage && <div className="success-banner">{successMessage}</div>}

                    {/* Tab: Documents */}
                    {activeTab === 'documents' && (
                        <section className="config-section">
                            <div className="section-header">
                                <h2>Documentos de Contexto</h2>
                                <div className="button-group">
                                    <button
                                        className="analyze-button"
                                        onClick={handleAnalyzeDocuments}
                                        disabled={isAnalyzing}
                                    >
                                        {isAnalyzing ? 'Procesando...' : 'Analizar Duplicados'}
                                    </button>
                                    <button
                                        className="summarize-button"
                                        onClick={handleSummarizeDocuments}
                                        disabled={isAnalyzing}
                                    >
                                        {isAnalyzing ? '...' : 'Resumir para IA'}
                                    </button>
                                    <label className="add-button upload-button">
                                        + Subir Archivo
                                        <input
                                            type="file"
                                            accept=".txt,.md"
                                            onChange={handleUploadDocument}
                                            style={{ display: 'none' }}
                                        />
                                    </label>
                                </div>
                            </div>
                            <p className="section-description">
                                Archivos que el asistente usa como contexto. Haz clic en un documento para editarlo.
                            </p>

                            <div className="analysis-section" style={{ marginBottom: '20px' }}>
                                {analysisResult && (
                                    <div className="analysis-result" style={{
                                        marginTop: '15px',
                                        padding: '15px',
                                        background: 'rgba(255, 255, 255, 0.05)',
                                        borderRadius: '8px',
                                        border: '1px solid rgba(255, 255, 255, 0.1)',
                                        color: '#e0e0e0',
                                        whiteSpace: 'pre-wrap',
                                        lineHeight: '1.6'
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                                            <h3 style={{ margin: 0, color: '#c77dff' }}>Resultado del Análisis:</h3>
                                            <button
                                                onClick={() => setAnalysisResult(null)}
                                                style={{ background: 'none', border: 'none', color: '#aaa', cursor: 'pointer' }}
                                            >
                                                ✕
                                            </button>
                                        </div>
                                        {analysisResult}
                                    </div>
                                )}
                            </div>

                            {editingDoc ? (
                                <div className="document-editor">
                                    <div className="editor-header">
                                        <h3>{editingDoc}</h3>
                                        <div className="editor-actions">
                                            <button
                                                className="save-button"
                                                onClick={handleSaveDocument}
                                                disabled={saving}
                                            >
                                                {saving ? 'Guardando...' : 'Guardar'}
                                            </button>
                                            <button
                                                className="reload-button"
                                                onClick={() => setEditingDoc(null)}
                                            >
                                                Cancelar
                                            </button>
                                        </div>
                                    </div>
                                    <textarea
                                        value={editContent}
                                        onChange={(e) => setEditContent(e.target.value)}
                                        className="document-textarea"
                                        placeholder="Escribe el contenido del documento..."
                                        spellCheck={false}
                                    />
                                </div>
                            ) : (
                                <div className="documents-list">
                                    {documents.map(doc => (
                                        <div key={doc.name} className="document-item">
                                            <div className="document-item-header">
                                                <div className="document-item-info">
                                                    <span className="document-item-name">{doc.name}</span>
                                                    <span className="document-item-meta">
                                                        {(doc.size / 1024).toFixed(1)} KB · {doc.lines} lineas
                                                    </span>
                                                </div>
                                                <div className="document-item-actions">
                                                    <button
                                                        className="edit-button"
                                                        onClick={() => handleEditDocument(doc)}
                                                    >
                                                        Editar
                                                    </button>
                                                    <button
                                                        className="delete-button"
                                                        onClick={() => handleDeleteDocument(doc.name)}
                                                    >
                                                        x
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="document-item-preview">
                                                {doc.preview}
                                            </div>
                                        </div>
                                    ))}
                                    {documents.length === 0 && (
                                        <div className="empty-state">
                                            No hay documentos. Sube archivos .txt o .md para agregar contexto al asistente.
                                        </div>
                                    )}
                                </div>
                            )}
                        </section>
                    )}

                    {/* Tab: ENV Variables - REMOVED */}

                    {/* Tab: IoT Devices */}
                    {activeTab === 'iot' && (
                        <section className="config-section">
                            <div className="section-header">
                                <h2>Dispositivos IoT</h2>
                                <button className="add-button" onClick={addIoTDevice}>+ Agregar Dispositivo</button>
                            </div>
                            <p className="section-description">
                                Cada dispositivo crea comandos on/off que el asistente puede ejecutar
                            </p>

                            <div className="iot-devices-list">
                                {iotDevices.map(device => (
                                    <div key={device.id} className="iot-device-card">
                                        <div className="device-header">
                                            <input
                                                type="text"
                                                defaultValue={device.id.replace(/_/g, ' ')}
                                                onBlur={e => renameIoTDevice(device.id, e.target.value)}
                                                className="device-name-input"
                                            />
                                            <div className="device-controls">
                                                <button
                                                    className="iot-btn on"
                                                    onClick={() => executeIoTAction(device.onUrl)}
                                                >
                                                    Encender
                                                </button>
                                                <button
                                                    className="iot-btn off"
                                                    onClick={() => executeIoTAction(device.offUrl)}
                                                >
                                                    Apagar
                                                </button>
                                                <button
                                                    className="delete-button"
                                                    onClick={() => deleteIoTDevice(device.id)}
                                                >
                                                    x
                                                </button>
                                            </div>
                                        </div>

                                        <div className="device-config">
                                            <div className="config-row">
                                                <label>URL Encender:</label>
                                                <input
                                                    type="text"
                                                    value={device.onUrl}
                                                    onChange={e => updateDeviceUrl(device.id, 'on', e.target.value)}
                                                    className="url-input"
                                                    placeholder="http://192.168.1.X/relay?action=on"
                                                />
                                            </div>
                                            <div className="config-row">
                                                <label>URL Apagar:</label>
                                                <input
                                                    type="text"
                                                    value={device.offUrl}
                                                    onChange={e => updateDeviceUrl(device.id, 'off', e.target.value)}
                                                    className="url-input"
                                                    placeholder="http://192.168.1.X/relay?action=off"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ))}

                                {iotDevices.length === 0 && (
                                    <div className="empty-state">
                                        No hay dispositivos configurados. Haz clic en "+ Agregar Dispositivo" para comenzar.
                                    </div>
                                )}
                            </div>

                            {/* IoT Groups */}
                            <div className="groups-section">
                                <div className="section-header">
                                    <h3>Grupos de Dispositivos</h3>
                                    <button className="add-button" onClick={() => {
                                        const groupName = prompt('Nombre del grupo:');
                                        if (!groupName) return;
                                        const cleanName = groupName.toLowerCase().replace(/\s+/g, '_');
                                        const c = { ...config };
                                        c.comandos.commands.push({
                                            id: `grupo_${cleanName}_on`,
                                            isGroup: true,
                                            triggers: [`prende ${groupName}`, `enciende ${groupName}`],
                                            tool: 'visit_url',
                                            args: { url: 'http://192.168.1.X/group=on' },
                                            response: `Grupo ${groupName} encendido.`
                                        });
                                        c.comandos.commands.push({
                                            id: `grupo_${cleanName}_off`,
                                            isGroup: true,
                                            triggers: [`apaga ${groupName}`, `desactiva ${groupName}`],
                                            tool: 'visit_url',
                                            args: { url: 'http://192.168.1.X/group=off' },
                                            response: `Grupo ${groupName} apagado.`
                                        });
                                        setConfig(c);
                                    }}>+ Agregar Grupo</button>
                                </div>

                                <div className="iot-devices-list">
                                    {config?.comandos?.commands?.filter(cmd => cmd.id.startsWith('grupo_') || cmd.isGroup).reduce((groups, cmd) => {
                                        const match = cmd.id.match(/^grupo_(.+?)_(on|off)$/);
                                        if (match) {
                                            const groupId = match[1];
                                            const action = match[2];
                                            if (!groups[groupId]) {
                                                groups[groupId] = { id: groupId, onUrl: '', offUrl: '' };
                                            }
                                            if (action === 'on') groups[groupId].onUrl = cmd.args?.url || '';
                                            else groups[groupId].offUrl = cmd.args?.url || '';
                                        }
                                        return groups;
                                    }, {}) && Object.values(config?.comandos?.commands?.filter(cmd => cmd.id.startsWith('grupo_') || cmd.isGroup).reduce((groups, cmd) => {
                                        const match = cmd.id.match(/^grupo_(.+?)_(on|off)$/);
                                        if (match) {
                                            const groupId = match[1];
                                            const action = match[2];
                                            if (!groups[groupId]) {
                                                groups[groupId] = { id: groupId, onUrl: '', offUrl: '' };
                                            }
                                            if (action === 'on') groups[groupId].onUrl = cmd.args?.url || '';
                                            else groups[groupId].offUrl = cmd.args?.url || '';
                                        }
                                        return groups;
                                    }, {})).map(group => (
                                        <div key={group.id} className="iot-device-card">
                                            <div className="device-header">
                                                <input
                                                    type="text"
                                                    defaultValue={group.id.replace(/_/g, ' ')}
                                                    className="device-name-input"
                                                    readOnly
                                                />
                                                <div className="device-controls">
                                                    <button
                                                        className="iot-btn on"
                                                        onClick={() => executeIoTAction(group.onUrl)}
                                                    >
                                                        Encender
                                                    </button>
                                                    <button
                                                        className="iot-btn off"
                                                        onClick={() => executeIoTAction(group.offUrl)}
                                                    >
                                                        Apagar
                                                    </button>
                                                    <button
                                                        className="delete-button"
                                                        onClick={() => {
                                                            if (!confirm(`Eliminar grupo ${group.id}?`)) return;
                                                            const c = { ...config };
                                                            c.comandos.commands = c.comandos.commands.filter(
                                                                cmd => !cmd.id.startsWith(`grupo_${group.id}_`)
                                                            );
                                                            setConfig(c);
                                                        }}
                                                    >
                                                        x
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="device-config">
                                                <div className="group-devices-section">
                                                    <label className="group-devices-label">Dispositivos en este grupo:</label>

                                                    <div className="selected-devices-list">
                                                        {(() => {
                                                            const groupCmd = config?.comandos?.commands?.find(c => c.id === `grupo_${group.id}_on`);
                                                            const deviceIds = groupCmd?.deviceIds || [];

                                                            if (deviceIds.length === 0) {
                                                                return <div className="empty-devices-message">No hay dispositivos en este grupo</div>;
                                                            }

                                                            return deviceIds.map(deviceId => {
                                                                const device = iotDevices.find(d => d.id === deviceId);
                                                                if (!device) return null;

                                                                return (
                                                                    <div key={deviceId} className="selected-device-item">
                                                                        <span className="selected-device-name">{device.id.replace(/_/g, ' ')}</span>
                                                                        <button
                                                                            className="remove-device-btn"
                                                                            onClick={() => {
                                                                                const c = { ...config };
                                                                                const onCmd = c.comandos.commands.find(x => x.id === `grupo_${group.id}_on`);
                                                                                const offCmd = c.comandos.commands.find(x => x.id === `grupo_${group.id}_off`);

                                                                                if (onCmd && offCmd) {
                                                                                    onCmd.deviceIds = (onCmd.deviceIds || []).filter(id => id !== deviceId);
                                                                                    offCmd.deviceIds = (offCmd.deviceIds || []).filter(id => id !== deviceId);
                                                                                    setConfig(c);
                                                                                }
                                                                            }}
                                                                        >×</button>
                                                                    </div>
                                                                );
                                                            });
                                                        })()}
                                                    </div>

                                                    <div className="add-device-dropdown">
                                                        <select
                                                            className="device-select"
                                                            onChange={(e) => {
                                                                if (!e.target.value) return;
                                                                const deviceId = e.target.value;
                                                                const c = { ...config };
                                                                const onCmd = c.comandos.commands.find(x => x.id === `grupo_${group.id}_on`);
                                                                const offCmd = c.comandos.commands.find(x => x.id === `grupo_${group.id}_off`);

                                                                if (onCmd && offCmd) {
                                                                    if (!onCmd.deviceIds) onCmd.deviceIds = [];
                                                                    if (!offCmd.deviceIds) offCmd.deviceIds = [];

                                                                    if (!onCmd.deviceIds.includes(deviceId)) {
                                                                        onCmd.deviceIds.push(deviceId);
                                                                        offCmd.deviceIds.push(deviceId);
                                                                        setConfig(c);
                                                                    }
                                                                }
                                                                e.target.value = '';
                                                            }}
                                                            defaultValue=""
                                                        >
                                                            <option value="" disabled>+ Agregar dispositivo</option>
                                                            {iotDevices.map(device => {
                                                                const groupCmd = config?.comandos?.commands?.find(c => c.id === `grupo_${group.id}_on`);
                                                                const deviceIds = groupCmd?.deviceIds || [];
                                                                if (deviceIds.includes(device.id)) return null;

                                                                return (
                                                                    <option key={device.id} value={device.id}>
                                                                        {device.id.replace(/_/g, ' ')}
                                                                    </option>
                                                                );
                                                            })}
                                                        </select>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </section>
                    )}

                    {/* Tab: IoT Services */}
                    {activeTab === 'iot-services' && (
                        <section className="config-section">
                            <h2>Servicios IoT</h2>
                            <p className="section-description">Configura los módulos de servicios IoT</p>

                            <div className="iot-services-list">
                                {[
                                    {
                                        key: 'camera',
                                        label: 'Camera Service',
                                        description: 'Control de cámaras',
                                        config: [
                                            { name: 'connection_type', label: 'Tipo de Conexión', type: 'select', options: ['Network', 'USB'] },
                                            { name: 'rtsp_url', label: 'URL RTSP', type: 'text', placeholder: 'rtsp://192.168.1.100:554/stream', showIf: 'connection_type', showValue: 'Network' },
                                            { name: 'usb_port', label: 'Cámara/Puerto USB', type: 'device_select', deviceType: 'camera', showIf: 'connection_type', showValue: 'USB' },
                                            { name: 'resolution', label: 'Resolución', type: 'select', options: ['720p', '1080p', '4K'] },
                                            { name: 'fps', label: 'FPS', type: 'number', placeholder: '30' }
                                        ]
                                    },
                                    {
                                        key: 'door_control',
                                        label: 'Door Control Service',
                                        description: 'Control de puertas',
                                        config: [
                                            { name: 'connection_type', label: 'Tipo de Conexión', type: 'select', options: ['Network', 'USB'] },
                                            { name: 'api_url', label: 'URL API', type: 'text', placeholder: 'http://192.168.1.101/api', showIf: 'connection_type', showValue: 'Network' },
                                            { name: 'serial_port', label: 'Puerto Serial', type: 'device_select', deviceType: 'serial', showIf: 'connection_type', showValue: 'USB' },
                                            { name: 'baud_rate', label: 'Baud Rate', type: 'select', options: ['9600', '19200', '115200'], showIf: 'connection_type', showValue: 'USB' },
                                            { name: 'timeout', label: 'Timeout (ms)', type: 'number', placeholder: '5000' }
                                        ]
                                    },
                                    {
                                        key: 'elevator_sensor',
                                        label: 'Elevator Sensor Service',
                                        description: 'Sensores de ascensor',
                                        config: [
                                            { name: 'sensor_ip', label: 'IP del Sensor', type: 'text', placeholder: '192.168.1.102' },
                                            { name: 'port', label: 'Puerto', type: 'number', placeholder: '8080' }
                                        ]
                                    },
                                    {
                                        key: 'home_sensor',
                                        label: 'Home Sensor Service',
                                        description: 'Sensores del hogar',
                                        config: [
                                            { name: 'mqtt_broker', label: 'MQTT Broker', type: 'text', placeholder: 'mqtt://192.168.1.1:1883' },
                                            { name: 'topic', label: 'Topic', type: 'text', placeholder: 'home/sensors' }
                                        ]
                                    },
                                    {
                                        key: 'iot_control',
                                        label: 'IoT Control Service',
                                        description: 'Control general IoT',
                                        config: [
                                            { name: 'base_url', label: 'URL Base', type: 'text', placeholder: 'http://192.168.1.1' },
                                            { name: 'api_key', label: 'API Key', type: 'password', placeholder: 'Tu API key' }
                                        ]
                                    },
                                    {
                                        key: 'music',
                                        label: 'Music Service',
                                        description: 'Control de música',
                                        config: [
                                            { name: 'spotify_url', label: 'Spotify API', type: 'text', placeholder: 'https://api.spotify.com' },
                                            { name: 'volume', label: 'Volumen por defecto', type: 'number', placeholder: '50' }
                                        ]
                                    },
                                    {
                                        key: 'sensor_base',
                                        label: 'Sensor Base Service',
                                        description: 'Base de sensores',
                                        config: [
                                            { name: 'polling_interval', label: 'Intervalo de polling (ms)', type: 'number', placeholder: '1000' },
                                            { name: 'max_retries', label: 'Reintentos máximos', type: 'number', placeholder: '3' }
                                        ]
                                    }
                                ].map(service => {
                                    const serviceConfig = integrations[service.key] || { enabled: false };
                                    const expanded = expandedServices[service.key] || false;

                                    return (
                                        <div key={service.key} className="iot-service-card">
                                            <div className="iot-service-header" onClick={() => setExpandedServices({
                                                ...expandedServices,
                                                [service.key]: !expanded
                                            })}>
                                                <div className="iot-service-info">
                                                    <span className="iot-service-name">{service.label}</span>
                                                    <span className="iot-service-description">{service.description}</span>
                                                </div>
                                                <div className="iot-service-controls">
                                                    <label className="toggle" onClick={e => e.stopPropagation()}>
                                                        <input
                                                            type="checkbox"
                                                            checked={serviceConfig.enabled ?? false}
                                                            onChange={e => toggleIntegration(service.key, e.target.checked)}
                                                        />
                                                        <span className="slider"></span>
                                                    </label>
                                                    <span className="expand-icon">{expanded ? '▼' : '▶'}</span>
                                                </div>
                                            </div>

                                            {expanded && (
                                                <div className="iot-service-config">
                                                    {service.config.map(field => {
                                                        // Check if field should be shown based on condition
                                                        if (field.showIf && field.showValue) {
                                                            const conditionValue = serviceConfig[field.showIf];
                                                            if (conditionValue !== field.showValue) {
                                                                return null; // Hide field
                                                            }
                                                        }

                                                        return (
                                                            <div key={field.name} className="config-field">
                                                                <label>{field.label}</label>
                                                                {field.type === 'device_select' ? (
                                                                    <select
                                                                        value={serviceConfig[field.name] || ''}
                                                                        onChange={e => {
                                                                            const newConfig = { ...integrations };
                                                                            if (!newConfig[service.key]) newConfig[service.key] = { enabled: false };
                                                                            newConfig[service.key][field.name] = e.target.value;
                                                                            setIntegrations(newConfig);
                                                                            fetch('/api/config/integrations', {
                                                                                method: 'POST',
                                                                                headers: { 'Content-Type': 'application/json' },
                                                                                body: JSON.stringify(newConfig)
                                                                            });
                                                                        }}
                                                                    >
                                                                        <option value="">Seleccionar dispositivo...</option>
                                                                        {field.deviceType === 'camera' && availableCameras.map(cam => (
                                                                            <option key={cam.path} value={cam.path}>
                                                                                {cam.name} ({cam.path})
                                                                            </option>
                                                                        ))}
                                                                        {field.deviceType === 'serial' && availableSerialPorts.map(port => (
                                                                            <option key={port.path} value={port.path}>
                                                                                {port.path} {port.manufacturer && `- ${port.manufacturer}`}
                                                                            </option>
                                                                        ))}
                                                                    </select>
                                                                ) : field.type === 'select' ? (
                                                                    <select
                                                                        value={serviceConfig[field.name] || ''}
                                                                        onChange={e => {
                                                                            const newConfig = { ...integrations };
                                                                            if (!newConfig[service.key]) newConfig[service.key] = { enabled: false };
                                                                            newConfig[service.key][field.name] = e.target.value;
                                                                            setIntegrations(newConfig);
                                                                            fetch('/api/config/integrations', {
                                                                                method: 'POST',
                                                                                headers: { 'Content-Type': 'application/json' },
                                                                                body: JSON.stringify(newConfig)
                                                                            });
                                                                        }}
                                                                    >
                                                                        <option value="">Seleccionar...</option>
                                                                        {field.options.map(opt => (
                                                                            <option key={opt} value={opt}>{opt}</option>
                                                                        ))}
                                                                    </select>
                                                                ) : (
                                                                    <input
                                                                        type={field.type}
                                                                        placeholder={field.placeholder}
                                                                        value={serviceConfig[field.name] || ''}
                                                                        onChange={e => {
                                                                            const newConfig = { ...integrations };
                                                                            if (!newConfig[service.key]) newConfig[service.key] = { enabled: false };
                                                                            newConfig[service.key][field.name] = e.target.value;
                                                                            setIntegrations(newConfig);
                                                                            fetch('/api/config/integrations', {
                                                                                method: 'POST',
                                                                                headers: { 'Content-Type': 'application/json' },
                                                                                body: JSON.stringify(newConfig)
                                                                            });
                                                                        }}
                                                                    />
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </section>
                    )}

                    {/* Tab: Services */}
                    {activeTab === 'services' && (
                        <section className="config-section">
                            <h2>Estado de Servicios</h2>
                            <p className="section-description">Servicios activos en el servidor</p>
                            <div className="services-grid">
                                {servicesStatus.map(s => (
                                    <div key={s.name} className={`service-card ${s.isReady ? 'ready' : 'pending'}`}>
                                        <div className="service-icon">{s.isReady ? '✓' : '...'}</div>
                                        <div className="service-info">
                                            <span className="service-name">{s.name}</span>
                                            <span className="service-status">
                                                {s.isReady ? 'Activo' : 'Pendiente'}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <button className="reload-button" onClick={loadAllData} style={{ marginTop: '1rem' }}>
                                Refrescar
                            </button>
                        </section>
                    )}

                    {/* Tab: Integrations */}
                    {activeTab === 'integrations' && integrations && (
                        <section className="config-section">
                            <h2>Integraciones</h2>
                            <p className="section-description">Habilita o deshabilita modulos</p>

                            <div className="integrations-grid">
                                {[
                                    { key: 'Avatar', label: 'Avatar' },
                                    { key: 'Base', label: 'Base' },
                                    { key: 'Calendar', label: 'Calendar' },
                                    { key: 'Data', label: 'Data' },
                                    { key: 'IoT', label: 'IoT' },
                                    { key: 'LLM', label: 'LLM' },
                                    { key: 'Media', label: 'Media' },
                                    { key: 'Recognition', label: 'Recognition' },
                                    { key: 'TTS', label: 'TTS' },
                                    { key: 'WhatsApp', label: 'WhatsApp' }
                                ].map(service => (
                                    <div key={service.key} className="integration-card">
                                        <div className="integration-header">
                                            <span className="integration-name">{service.label}</span>
                                            <label className="toggle">
                                                <input
                                                    type="checkbox"
                                                    checked={integrations[service.key]?.enabled ?? false}
                                                    onChange={e => toggleIntegration(service.key, e.target.checked)}
                                                />
                                                <span className="slider"></span>
                                            </label>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}

                    {/* Tab: WhatsApp */}
                    {activeTab === 'whatsapp' && (
                        <section className="config-section">
                            <div className="section-header">
                                <h2>Contactos WhatsApp</h2>
                                <button className="add-button" onClick={addContact}>+ Agregar</button>
                            </div>
                            <div className="commands-grid">
                                {Object.entries(phones).map(([name, phone]) => (
                                    <div key={name} className="command-card contact-card">
                                        <div className="command-header">
                                            <input
                                                type="text"
                                                defaultValue={name}
                                                onBlur={e => updatePhoneName(name, e.target.value)}
                                                className="id-input"
                                            />
                                            <button className="delete-button" onClick={() => deleteContact(name)}>x</button>
                                        </div>
                                        <div className="form-group">
                                            <label>Telefono:</label>
                                            <input
                                                type="tel"
                                                value={phone}
                                                onChange={e => updatePhoneNumber(name, e.target.value)}
                                                className="url-input"
                                                placeholder="56912345678"
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}

                    {/* Actions */}
                    <div className="actions">
                        <button onClick={handleSaveAll} disabled={saving} className="save-button">
                            {saving ? 'Guardando...' : 'Guardar Todo'}
                        </button>
                        <button onClick={loadAllData} className="reload-button">Recargar</button>
                    </div>
                </main>
            </div>
        </div>
    );
}

export default ConfigPage;
