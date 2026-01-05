import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import './ConfigPage.css';

function ConfigPage() {
    const [config, setConfig] = useState(null);
    const [phones, setPhones] = useState({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const [successMessage, setSuccessMessage] = useState('');

    useEffect(() => {
        loadConfig();
    }, []);

    const loadConfig = async () => {
        try {
            setLoading(true);

            // Cargar instrucciones
            const instructionsRes = await fetch('http://localhost:3000/api/config/instructions');
            if (!instructionsRes.ok) throw new Error('Error cargando configuración');
            const instructionsData = await instructionsRes.json();
            setConfig(instructionsData);

            // Cargar teléfonos
            const phonesRes = await fetch('http://localhost:3000/api/config/phones');
            if (phonesRes.ok) {
                const phonesData = await phonesRes.json();
                setPhones(phonesData);
            }

            setError(null);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        try {
            setSaving(true);
            setError(null);
            setSuccessMessage('');

            // Guardar instrucciones
            const instructionsRes = await fetch('http://localhost:3000/api/config/instructions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(config)
            });

            if (!instructionsRes.ok) {
                const errorData = await instructionsRes.json();
                throw new Error(errorData.error || 'Error guardando configuración');
            }

            // Guardar teléfonos
            const phonesRes = await fetch('http://localhost:3000/api/config/phones', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(phones)
            });

            if (!phonesRes.ok) {
                const errorData = await phonesRes.json();
                throw new Error(errorData.error || 'Error guardando teléfonos');
            }

            setSuccessMessage('Configuración guardada correctamente');
            setTimeout(() => setSuccessMessage(''), 3000);
        } catch (err) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    const updateCommandUrl = (commandIndex, newUrl) => {
        const newConfig = { ...config };
        newConfig.comandos.commands[commandIndex].args.url = newUrl;
        setConfig(newConfig);
    };

    const updateCommandResponse = (commandIndex, newResponse) => {
        const newConfig = { ...config };
        newConfig.comandos.commands[commandIndex].response = newResponse;
        setConfig(newConfig);
    };

    const updateCommandTriggers = (commandIndex, triggersString) => {
        const newConfig = { ...config };
        newConfig.comandos.commands[commandIndex].triggers = triggersString
            .split(',')
            .map(t => t.trim())
            .filter(t => t.length > 0);
        setConfig(newConfig);
    };

    const addNewCommand = () => {
        const newConfig = { ...config };
        const newId = `action_${Date.now()}`;
        newConfig.comandos.commands.push({
            id: newId,
            triggers: ['nuevo trigger'],
            tool: 'visit_url',
            args: { url: 'https://example.com/action' },
            response: 'Acción ejecutada.'
        });
        setConfig(newConfig);
    };

    const deleteCommand = (commandIndex) => {
        if (!confirm('¿Eliminar esta acción?')) return;
        const newConfig = { ...config };
        newConfig.comandos.commands.splice(commandIndex, 1);
        setConfig(newConfig);
    };

    const updateCommandId = (commandIndex, newId) => {
        const newConfig = { ...config };
        newConfig.comandos.commands[commandIndex].id = newId;
        setConfig(newConfig);
    };

    // Funciones para teléfonos
    const updatePhoneName = (oldName, newName) => {
        if (oldName === newName) return;
        const newPhones = { ...phones };
        const phoneNumber = newPhones[oldName];
        delete newPhones[oldName];
        newPhones[newName] = phoneNumber;
        setPhones(newPhones);
    };

    const updatePhoneNumber = (name, newNumber) => {
        setPhones({ ...phones, [name]: newNumber });
    };

    const addNewContact = () => {
        const newName = `Contacto_${Object.keys(phones).length + 1}`;
        setPhones({ ...phones, [newName]: '' });
    };

    const deleteContact = (name) => {
        if (!confirm(`¿Eliminar contacto "${name}"?`)) return;
        const newPhones = { ...phones };
        delete newPhones[name];
        setPhones(newPhones);
    };

    if (loading) {
        return (
            <div className="config-page">
                <div className="loading">Cargando configuración...</div>
            </div>
        );
    }

    if (error && !config) {
        return (
            <div className="config-page">
                <div className="error">Error: {error}</div>
                <button onClick={loadConfig}>Reintentar</button>
            </div>
        );
    }

    return (
        <div className="config-page">
            <header className="config-header">
                <div className="header-content">
                    <h1>Configuración del Asistente</h1>
                    <Link to="/" className="back-link">Volver al Asistente</Link>
                </div>
            </header>

            <main className="config-content">
                {error && <div className="error-banner">{error}</div>}
                {successMessage && <div className="success-banner">{successMessage}</div>}

                {/* Contactos / Teléfonos */}
                <section className="config-section">
                    <div className="section-header">
                        <h2>Contactos WhatsApp</h2>
                        <button className="add-button" onClick={addNewContact}>
                            + Agregar Contacto
                        </button>
                    </div>
                    <p className="section-description">
                        Números de teléfono para notificaciones por WhatsApp
                    </p>

                    <div className="commands-grid">
                        {Object.entries(phones).map(([name, phone]) => (
                            <div key={name} className="command-card contact-card">
                                <div className="command-header">
                                    <input
                                        type="text"
                                        defaultValue={name}
                                        onBlur={(e) => updatePhoneName(name, e.target.value)}
                                        className="id-input"
                                        placeholder="Nombre"
                                    />
                                    <button
                                        className="delete-button"
                                        onClick={() => deleteContact(name)}
                                        title="Eliminar"
                                    >
                                        x
                                    </button>
                                </div>
                                <div className="command-body">
                                    <div className="form-group">
                                        <label>Teléfono:</label>
                                        <input
                                            type="tel"
                                            value={phone}
                                            onChange={(e) => updatePhoneNumber(name, e.target.value)}
                                            className="url-input"
                                            placeholder="56912345678"
                                        />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Comandos IoT */}
                <section className="config-section">
                    <div className="section-header">
                        <h2>Acciones IoT</h2>
                        <button className="add-button" onClick={addNewCommand}>
                            + Agregar Acción
                        </button>
                    </div>
                    <p className="section-description">
                        {config?.comandos?.description}
                    </p>

                    <div className="commands-grid">
                        {config?.comandos?.commands?.map((cmd, index) => (
                            <div key={cmd.id + index} className="command-card">
                                <div className="command-header">
                                    <input
                                        type="text"
                                        value={cmd.id}
                                        onChange={(e) => updateCommandId(index, e.target.value)}
                                        className="id-input"
                                        placeholder="ID del comando"
                                    />
                                    <div className="command-actions">
                                        <span className="status-badge">{cmd.tool}</span>
                                        <button
                                            className="delete-button"
                                            onClick={() => deleteCommand(index)}
                                            title="Eliminar"
                                        >
                                            x
                                        </button>
                                    </div>
                                </div>

                                <div className="command-body">
                                    <div className="form-group">
                                        <label>Triggers (separados por coma):</label>
                                        <input
                                            type="text"
                                            value={cmd.triggers.join(', ')}
                                            onChange={(e) => updateCommandTriggers(index, e.target.value)}
                                            className="url-input"
                                            placeholder="enciende luz, prende luz"
                                        />
                                    </div>

                                    <div className="form-group">
                                        <label>URL:</label>
                                        <input
                                            type="text"
                                            value={cmd.args.url}
                                            onChange={(e) => updateCommandUrl(index, e.target.value)}
                                            className="url-input"
                                        />
                                    </div>

                                    <div className="form-group">
                                        <label>Respuesta:</label>
                                        <input
                                            type="text"
                                            value={cmd.response}
                                            onChange={(e) => updateCommandResponse(index, e.target.value)}
                                            className="response-input"
                                        />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Botones de Acción */}
                <div className="actions">
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="save-button"
                    >
                        {saving ? 'Guardando...' : 'Guardar Cambios'}
                    </button>
                    <button
                        onClick={loadConfig}
                        className="reload-button"
                    >
                        Recargar
                    </button>
                </div>
            </main>
        </div>
    );
}

export default ConfigPage;
