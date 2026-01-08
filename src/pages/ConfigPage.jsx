import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import './ConfigPage.css';

function ConfigPage() {
    const [activeTab, setActiveTab] = useState('iot');
    const [config, setConfig] = useState(null);
    const [phones, setPhones] = useState({});
    const [integrations, setIntegrations] = useState(null);
    const [servicesStatus, setServicesStatus] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const [successMessage, setSuccessMessage] = useState('');

    useEffect(() => {
        loadAllData();
    }, []);

    const loadAllData = async () => {
        try {
            setLoading(true);
            setError(null);

            const [instructionsRes, phonesRes, integrationsRes, servicesRes] = await Promise.all([
                fetch('/api/config/instructions'),
                fetch('/api/config/phones'),
                fetch('/api/config/integrations'),
                fetch('/api/services/status')
            ]);

            if (instructionsRes.ok) setConfig(await instructionsRes.json());
            if (phonesRes.ok) setPhones(await phonesRes.json());
            if (integrationsRes.ok) setIntegrations(await integrationsRes.json());
            if (servicesRes.ok) setServicesStatus(await servicesRes.json());
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

    // ============ IoT DEVICES (linked with commands) ============

    // Get IoT devices from commands
    const getIotDevices = () => {
        if (!config?.comandos?.commands) return [];
        const devices = new Map();

        config.comandos.commands.forEach((cmd, idx) => {
            // Extract device name from command id (e.g., showroom_on -> showroom)
            // Skip groups (grupo_*)
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
            await fetch('/api/iot/action', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url })
            });
            setSuccessMessage('Accion ejecutada');
            setTimeout(() => setSuccessMessage(''), 2000);
        } catch (err) {
            // Direct HTTP call as fallback
            try {
                await fetch(url);
                setSuccessMessage('Accion ejecutada');
            } catch (e) {
                setError(e.message);
            }
        }
    };

    const addIoTDevice = () => {
        const deviceName = prompt('Nombre del dispositivo (sin espacios):');
        if (!deviceName) return;
        const cleanName = deviceName.toLowerCase().replace(/\s+/g, '_');

        const c = { ...config };
        // Add ON command
        c.comandos.commands.push({
            id: `${cleanName}_on`,
            triggers: [`prende ${deviceName}`, `enciende ${deviceName}`],
            tool: 'visit_url',
            args: { url: 'http://192.168.1.X/action=on' },
            response: `${deviceName} encendido.`
        });
        // Add OFF command
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

    const updateDeviceTriggers = (deviceId, action, triggersStr) => {
        const c = { ...config };
        const cmdId = `${deviceId}_${action}`;
        const cmd = c.comandos.commands.find(x => x.id === cmdId);
        if (cmd) cmd.triggers = triggersStr.split(',').map(t => t.trim()).filter(t => t);
        setConfig(c);
    };

    // ============ Integrations ============
    const toggleIntegration = (path, enabled) => {
        const newIntegrations = { ...integrations };
        const keys = path.split('.');
        let obj = newIntegrations;
        for (let i = 0; i < keys.length - 1; i++) obj = obj[keys[i]];
        obj[keys[keys.length - 1]].enabled = enabled;
        setIntegrations(newIntegrations);
    };

    // ============ Contacts ============
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
        { id: 'whatsapp', label: 'WhatsApp' }
    ];

    const iotDevices = getIotDevices();

    return (
        <div className="config-page">
            <header className="config-header">
                <div className="header-content">
                    <h1>Centro de Configuracion</h1>
                    <Link to="/" className="back-link">Volver</Link>
                </div>
            </header>

            <nav className="config-tabs">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
                        onClick={() => setActiveTab(tab.id)}
                    >
                        {tab.label}
                    </button>
                ))}
            </nav>

            <main className="config-content">
                {error && <div className="error-banner">{error}</div>}
                {successMessage && <div className="success-banner">{successMessage}</div>}

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

                        {/* Groups Section */}
                        <div className="groups-section">
                            <div className="section-header">
                                <h3>Grupos de Dispositivos</h3>
                                <button className="add-button" onClick={() => {
                                    const name = prompt('Nombre del grupo:');
                                    if (!name) return;
                                    const c = { ...config };
                                    const cleanName = name.toLowerCase().replace(/\s+/g, '_');
                                    // Create group command that calls multiple URLs
                                    c.comandos.commands.push({
                                        id: `grupo_${cleanName}_on`,
                                        triggers: [`prende ${name}`, `enciende ${name}`, `activa ${name}`],
                                        tool: 'visit_url',
                                        args: { url: '', urls: [] },
                                        response: `${name} encendido.`,
                                        isGroup: true,
                                        groupDevices: []
                                    });
                                    c.comandos.commands.push({
                                        id: `grupo_${cleanName}_off`,
                                        triggers: [`apaga ${name}`, `desactiva ${name}`],
                                        tool: 'visit_url',
                                        args: { url: '', urls: [] },
                                        response: `${name} apagado.`,
                                        isGroup: true,
                                        groupDevices: []
                                    });
                                    setConfig(c);
                                }}>+ Agregar Grupo</button>
                            </div>
                            <p className="section-description">
                                Los grupos permiten controlar multiples dispositivos con un solo comando
                            </p>

                            {config?.comandos?.commands?.filter(cmd => cmd.isGroup && cmd.id.endsWith('_on')).map(groupCmd => {
                                const groupId = groupCmd.id.replace('grupo_', '').replace('_on', '');
                                const offCmd = config.comandos.commands.find(c => c.id === `grupo_${groupId}_off`);
                                return (
                                    <div key={groupId} className="group-card">
                                        <div className="group-header">
                                            <input
                                                type="text"
                                                defaultValue={groupId.replace(/_/g, ' ')}
                                                className="group-name-input"
                                                onBlur={e => {
                                                    // Rename group
                                                    const newName = e.target.value.toLowerCase().replace(/\s+/g, '_');
                                                    if (newName === groupId) return;
                                                    const c = { ...config };
                                                    c.comandos.commands.forEach(cmd => {
                                                        if (cmd.id === `grupo_${groupId}_on`) cmd.id = `grupo_${newName}_on`;
                                                        if (cmd.id === `grupo_${groupId}_off`) cmd.id = `grupo_${newName}_off`;
                                                    });
                                                    setConfig(c);
                                                }}
                                            />
                                            <div className="device-controls">
                                                <button className="iot-btn on" onClick={async () => {
                                                    for (const deviceId of (groupCmd.groupDevices || [])) {
                                                        const dev = iotDevices.find(d => d.id === deviceId);
                                                        if (dev?.onUrl) await fetch(dev.onUrl).catch(() => { });
                                                    }
                                                    setSuccessMessage('Grupo encendido');
                                                    setTimeout(() => setSuccessMessage(''), 2000);
                                                }}>Encender</button>
                                                <button className="iot-btn off" onClick={async () => {
                                                    for (const deviceId of (groupCmd.groupDevices || [])) {
                                                        const dev = iotDevices.find(d => d.id === deviceId);
                                                        if (dev?.offUrl) await fetch(dev.offUrl).catch(() => { });
                                                    }
                                                    setSuccessMessage('Grupo apagado');
                                                    setTimeout(() => setSuccessMessage(''), 2000);
                                                }}>Apagar</button>
                                                <button className="delete-button" onClick={() => {
                                                    if (!confirm('Eliminar grupo?')) return;
                                                    const c = { ...config };
                                                    c.comandos.commands = c.comandos.commands.filter(
                                                        cmd => !cmd.id.startsWith(`grupo_${groupId}_`)
                                                    );
                                                    setConfig(c);
                                                }}>x</button>
                                            </div>
                                        </div>
                                        <div className="group-devices">
                                            {(groupCmd.groupDevices || []).map(deviceId => (
                                                <span key={deviceId} className="group-device-tag">
                                                    {deviceId.replace(/_/g, ' ')}
                                                    <button onClick={() => {
                                                        const c = { ...config };
                                                        const cmd = c.comandos.commands.find(x => x.id === groupCmd.id);
                                                        const offC = c.comandos.commands.find(x => x.id === offCmd?.id);
                                                        if (cmd) cmd.groupDevices = cmd.groupDevices.filter(d => d !== deviceId);
                                                        if (offC) offC.groupDevices = offC.groupDevices.filter(d => d !== deviceId);
                                                        setConfig(c);
                                                    }}>x</button>
                                                </span>
                                            ))}
                                            <select
                                                className="add-device-select"
                                                value=""
                                                onChange={e => {
                                                    const deviceId = e.target.value;
                                                    if (!deviceId) return;
                                                    const c = { ...config };
                                                    const cmd = c.comandos.commands.find(x => x.id === groupCmd.id);
                                                    const offC = c.comandos.commands.find(x => x.id === offCmd?.id);
                                                    if (cmd) {
                                                        if (!cmd.groupDevices) cmd.groupDevices = [];
                                                        cmd.groupDevices.push(deviceId);
                                                    }
                                                    if (offC) {
                                                        if (!offC.groupDevices) offC.groupDevices = [];
                                                        offC.groupDevices.push(deviceId);
                                                    }
                                                    setConfig(c);
                                                }}
                                            >
                                                <option value="">+ Agregar dispositivo</option>
                                                {iotDevices
                                                    .filter(d => !(groupCmd.groupDevices || []).includes(d.id))
                                                    .map(d => (
                                                        <option key={d.id} value={d.id}>{d.id}</option>
                                                    ))
                                                }
                                            </select>
                                        </div>
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
                            <div className="integration-card">
                                <div className="integration-header">
                                    <span className="integration-name">📱 WhatsApp Messaging</span>
                                    <label className="toggle">
                                        <input
                                            type="checkbox"
                                            checked={integrations.whatsapp_messaging?.enabled ?? false}
                                            onChange={e => toggleIntegration('whatsapp_messaging', e.target.checked)}
                                        />
                                        <span className="slider"></span>
                                    </label>
                                </div>
                            </div>
                            <div className="integration-card">
                                <div className="integration-header">
                                    <span className="integration-name">💡 IoT Lights</span>
                                    <label className="toggle">
                                        <input
                                            type="checkbox"
                                            checked={integrations.iot_lights?.enabled ?? false}
                                            onChange={e => toggleIntegration('iot_lights', e.target.checked)}
                                        />
                                        <span className="slider"></span>
                                    </label>
                                </div>
                            </div>
                            <div className="integration-card">
                                <div className="integration-header">
                                    <span className="integration-name">📅 Calendario</span>
                                    <label className="toggle">
                                        <input
                                            type="checkbox"
                                            checked={integrations.calendar?.enabled ?? false}
                                            onChange={e => toggleIntegration('calendar', e.target.checked)}
                                        />
                                        <span className="slider"></span>
                                    </label>
                                </div>
                            </div>
                            <div className="integration-card">
                                <div className="integration-header">
                                    <span className="integration-name">🖼️ Media Display</span>
                                    <label className="toggle">
                                        <input
                                            type="checkbox"
                                            checked={integrations.media_display?.enabled ?? false}
                                            onChange={e => toggleIntegration('media_display', e.target.checked)}
                                        />
                                        <span className="slider"></span>
                                    </label>
                                </div>
                            </div>
                            <div className="integration-card">
                                <div className="integration-header">
                                    <span className="integration-name">🧍 Avatar Movements</span>
                                    <label className="toggle">
                                        <input
                                            type="checkbox"
                                            checked={integrations.avatar_movements?.enabled ?? false}
                                            onChange={e => toggleIntegration('avatar_movements', e.target.checked)}
                                        />
                                        <span className="slider"></span>
                                    </label>
                                </div>
                            </div>
                            <div className="integration-card">
                                <div className="integration-header">
                                    <span className="integration-name">📊 Data Collection</span>
                                    <label className="toggle">
                                        <input
                                            type="checkbox"
                                            checked={integrations.data_collection?.enabled ?? false}
                                            onChange={e => toggleIntegration('data_collection', e.target.checked)}
                                        />
                                        <span className="slider"></span>
                                    </label>
                                </div>
                            </div>
                            <div className="integration-card">
                                <div className="integration-header">
                                    <span className="integration-name">👤 Person Recognition</span>
                                    <label className="toggle">
                                        <input
                                            type="checkbox"
                                            checked={integrations.person_recognition?.enabled ?? false}
                                            onChange={e => toggleIntegration('person_recognition', e.target.checked)}
                                        />
                                        <span className="slider"></span>
                                    </label>
                                </div>
                            </div>
                        </div>

                        <h3 style={{ marginTop: '2rem', color: 'var(--heading)' }}>Sensores IoT</h3>
                        <div className="integrations-grid">
                            <div className="integration-card">
                                <div className="integration-header">
                                    <span className="integration-name">🚪 Puertas</span>
                                    <label className="toggle">
                                        <input
                                            type="checkbox"
                                            checked={integrations.iot_sensors?.doors?.enabled ?? false}
                                            onChange={e => toggleIntegration('iot_sensors.doors', e.target.checked)}
                                        />
                                        <span className="slider"></span>
                                    </label>
                                </div>
                            </div>
                            <div className="integration-card">
                                <div className="integration-header">
                                    <span className="integration-name">🎵 Musica</span>
                                    <label className="toggle">
                                        <input
                                            type="checkbox"
                                            checked={integrations.iot_sensors?.music?.enabled ?? false}
                                            onChange={e => toggleIntegration('iot_sensors.music', e.target.checked)}
                                        />
                                        <span className="slider"></span>
                                    </label>
                                </div>
                            </div>
                            <div className="integration-card">
                                <div className="integration-header">
                                    <span className="integration-name">📹 Camaras</span>
                                    <label className="toggle">
                                        <input
                                            type="checkbox"
                                            checked={integrations.iot_sensors?.cameras?.enabled ?? false}
                                            onChange={e => toggleIntegration('iot_sensors.cameras', e.target.checked)}
                                        />
                                        <span className="slider"></span>
                                    </label>
                                </div>
                            </div>
                            <div className="integration-card">
                                <div className="integration-header">
                                    <span className="integration-name">🛗 Ascensor</span>
                                    <label className="toggle">
                                        <input
                                            type="checkbox"
                                            checked={integrations.iot_sensors?.elevator?.enabled ?? false}
                                            onChange={e => toggleIntegration('iot_sensors.elevator', e.target.checked)}
                                        />
                                        <span className="slider"></span>
                                    </label>
                                </div>
                            </div>
                            <div className="integration-card">
                                <div className="integration-header">
                                    <span className="integration-name">🏠 Sensores Home</span>
                                    <label className="toggle">
                                        <input
                                            type="checkbox"
                                            checked={integrations.iot_sensors?.home_sensors?.enabled ?? false}
                                            onChange={e => toggleIntegration('iot_sensors.home_sensors', e.target.checked)}
                                        />
                                        <span className="slider"></span>
                                    </label>
                                </div>
                            </div>
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
    );
}

export default ConfigPage;
