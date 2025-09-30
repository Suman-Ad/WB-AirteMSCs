import React, { useState } from 'react';

/*
  CSS for the TrackerForm component.
  For simplicity, you can copy this and place it in your main CSS file (e.g., App.css),
  or use a styled-components approach if your project is set up for it.
*/
const styles = `
.tracker-form-container {
    max-width: 1400px;
    margin: 2rem auto;
    padding: 2rem;
    background-color: #ffffff;
    border-radius: 8px;
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
    font-family: sans-serif;
}

.tracker-form-container h1 {
    text-align: center;
    color: #2c3e50;
    border-bottom: 2px solid #3498db;
    padding-bottom: 0.5rem;
    margin-bottom: 2rem;
}

.form-section {
    border: 1px solid #dfe6e9;
    border-radius: 8px;
    padding: 1.5rem;
    margin-bottom: 2rem;
    background-color: #fdfdfd;
}

.form-section legend {
    font-size: 1.4em;
    font-weight: bold;
    color: #3498db;
    padding: 0 0.5em;
}

.fields-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 1.5rem;
}

.sub-section {
    margin-top: 1.5rem;
    padding-top: 1rem;
    border-top: 1px dashed #b2bec3;
}

.sub-section h4 {
    margin-bottom: 1rem;
    color: #2d3436;
}

.input-group {
    display: flex;
    flex-direction: column;
}

.input-group label {
    margin-bottom: 0.5rem;
    font-weight: 600;
    color: #555;
    text-transform: capitalize;
}

.input-group input,
.input-group select {
    padding: 0.7rem;
    border: 1px solid #ccc;
    border-radius: 4px;
    font-size: 1rem;
}

.submit-btn {
    display: block;
    width: 100%;
    padding: 1rem;
    font-size: 1.2rem;
    font-weight: bold;
    color: #fff;
    background-color: #27ae60;
    border: none;
    border-radius: 5px;
    cursor: pointer;
    transition: background-color 0.3s ease;
}

.submit-btn:hover {
    background-color: #229954;
}
`;

// Helper data for generating repetitive fields
const sceneBInterfaces = ['redfish', 'gui', 'restApi', 'sshCli', 'snmp'];
const sceneBFeatures = ['sensor', 'power', 'inventory', 'fwUpdate', 'eventLog', 'network', 'account', 'others'];
const classificationServers = ['openBmc', 'power', 'lenovo'];
const classificationCategories = ['software', 'hardware', 'firmware', 'driver', 'utility', 'os', 'process', 'userGuide', 'others'];


const RackTrackerForm = () => {
    
    // The initial state mirrors the spreadsheet structure
    const [formData, setFormData] = useState({
        identification: { date: '', sn: '', bt: '', implementation: '', apar: '', cmvcDefect: '' },
        sceneA: { browse: '3', license: '3', ethernet: '3', display: '3', diagnostics: '3', advancedDiagnostics: '3', cec: '3', fsp: '3', ipmi: '3', others: '3', kvmSol: '3' },
        sceneB: {
            redfish: { sensor: '1', power: '1', inventory: '1', fwUpdate: '1', eventLog: '1', network: '1', account: '1', others: '1' },
            gui: { sensor: '1', power: '1', inventory: '1', fwUpdate: '1', eventLog: '1', network: '1', account: '1', others: '1' },
            restApi: { sensor: '1', power: '1', inventory: '1', fwUpdate: '1', eventLog: '1', network: '1', account: '1', others: '1' },
            sshCli: { sensor: '1', power: '1', inventory: '1', fwUpdate: '1', eventLog: '1', network: '1', account: '1', others: '1' },
            snmp: { sensor: '1', power: '1', inventory: '1', fwUpdate: '1', eventLog: '1', network: '1', account: '1', others: '1' },
            otherFeatures: { account: '1', network: '1', time: '1', service: '1', eventLog: '1', smtp: '1', ldapAd: '1', ssl: '1', firewall: '1', kvmVmedia: '1', others: '1'}
        },
        classification: {
            openBmc: { software: '', hardware: '', firmware: '', driver: '', utility: '', os: '', process: '', userGuide: '', others: '' },
            power: { software: '', hardware: '', firmware: '', driver: '', utility: '', os: '', process: '', userGuide: '', others: '' },
            lenovo: { software: '', hardware: '', firmware: '', driver: '', utility: '', os: '', process: '', userGuide: '', others: '' },
        }
    });

    // A single, generic handler to update the nested state
    const handleChange = (e) => {
        const { name, value } = e.target;
        const keys = name.split('.'); // e.g., "sceneB.redfish.sensor"
        
        setFormData(prevData => {
            // Create a deep copy to avoid direct state mutation
            const newData = JSON.parse(JSON.stringify(prevData));
            
            let currentLevel = newData;
            for (let i = 0; i < keys.length - 1; i++) {
                currentLevel = currentLevel[keys[i]];
            }
            currentLevel[keys[keys.length - 1]] = value;
            
            return newData;
        });
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        console.log("Form Submitted Data:", JSON.stringify(formData, null, 2));
        alert('Form data has been logged to the browser console (Press F12 to view).');
    };

    // This renders a dropdown for pass/fail/na status
    const renderStatusSelect = (name, value) => (
        <select name={name} value={value} onChange={handleChange}>
            <option value="1">Pass / Tested</option>
            <option value="2">Fail</option>
            <option value="3">Not Applicable</option>
            <option value="4">Not Tested</option>
        </select>
    );

    return (
        <>
            <style>{styles}</style>
            <div className="tracker-form-container daily-log-container">
                <h1>Firmware Test & Classification Tracker</h1>
                <form onSubmit={handleSubmit}>

                    {/* Section 1: Identification */}
                    <fieldset className="form-section">
                        <legend>📝 Identification</legend>
                        <div className="fields-grid">
                            {Object.keys(formData.identification).map(key => (
                                <div className="input-group" key={key}>
                                    <label htmlFor={`identification.${key}`}>{key}</label>
                                    <input type={key === 'date' ? 'date' : 'text'} id={`identification.${key}`} name={`identification.${key}`} value={formData.identification[key]} onChange={handleChange} />
                                </div>
                            ))}
                        </div>
                    </fieldset>

                    {/* Section 2: Scene-A */}
                    <fieldset className="form-section">
                        <legend>🔬 Scene-A: Base Functions</legend>
                        <div className="fields-grid">
                            {Object.keys(formData.sceneA).map(key => (
                                <div className="input-group" key={key}>
                                    <label htmlFor={`sceneA.${key}`}>{key}</label>
                                    {renderStatusSelect(`sceneA.${key}`, formData.sceneA[key])}
                                </div>
                            ))}
                        </div>
                    </fieldset>

                    {/* Section 3: Scene-B */}
                    <fieldset className="form-section">
                        <legend>🖥️ Scene-B: Management Interfaces & Features</legend>
                        {sceneBInterfaces.map(iface => (
                            <div className="sub-section" key={iface}>
                                <h4>{iface.replace(/([A-Z])/g, ' $1').toUpperCase()}</h4>
                                <div className="fields-grid">
                                    {sceneBFeatures.map(feature => (
                                        <div className="input-group" key={`${iface}-${feature}`}>
                                            <label htmlFor={`sceneB.${iface}.${feature}`}>{feature}</label>
                                            {renderStatusSelect(`sceneB.${iface}.${feature}`, formData.sceneB[iface][feature])}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                         <div className="sub-section">
                                <h4>Other Features</h4>
                                <div className="fields-grid">
                                    {Object.keys(formData.sceneB.otherFeatures).map(key => (
                                        <div className="input-group" key={key}>
                                            <label htmlFor={`sceneB.otherFeatures.${key}`}>{key}</label>
                                            {renderStatusSelect(`sceneB.otherFeatures.${key}`, formData.sceneB.otherFeatures[key])}
                                        </div>
                                    ))}
                                </div>
                            </div>
                    </fieldset>
                    
                    {/* Section 4: Classification */}
                    <fieldset className="form-section">
                        <legend>🗂️ Classification Info</legend>
                        {classificationServers.map(server => (
                            <div className="sub-section" key={server}>
                                <h4>{server.replace(/([A-Z])/g, ' $1')} Based Server</h4>
                                <div className="fields-grid">
                                     {classificationCategories.map(cat => (
                                        <div className="input-group" key={`${server}-${cat}`}>
                                            <label htmlFor={`classification.${server}.${cat}`}>{cat}</label>
                                            <input type="text" placeholder="e.g., ECN990114" name={`classification.${server}.${cat}`} value={formData.classification[server][cat]} onChange={handleChange} />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </fieldset>

                    <button type="submit" className="submit-btn">Submit Rack Data</button>
                </form>
            </div>
        </>
    );
};

export default RackTrackerForm;