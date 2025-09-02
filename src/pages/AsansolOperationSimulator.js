import React, { useState, useEffect, useRef } from 'react';
import '../assets/AsansolOperationSimulator.css';

const AsansolOperationSimulator = () => {
  // State variables
  const [isEB_ON, setIsEB_ON] = useState(true);
  const [isEB1_ON, setIsEB1_ON] = useState(true);
  const [isEB2_ON, setIsEB2_ON] = useState(true);
  const [isDG1_ON, setIsDG1_ON] = useState(false);
  const [isDG2_ON, setIsDG2_ON] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [currentDG, setCurrentDG] = useState('DG-1');
  const [operationMode, setOperationMode] = useState('auto');
  const [busCoupler1Status, setBusCoupler1Status] = useState('open');
  const [busCoupler2Status, setBusCoupler2Status] = useState('open');
  const [eventLog, setEventLog] = useState([]);
  
  // Timer states
  const [dg1Timer, setDg1Timer] = useState(0);
  const [dg2Timer, setDg2Timer] = useState(0);
  const [eb1Timer, setEb1Timer] = useState(0);
  const [eb2Timer, setEb2Timer] = useState(0);
  const [busCoupler1Timer, setBusCoupler1Timer] = useState(0);
  const [busCoupler2Timer, setBusCoupler2Timer] = useState(0);
  
  // Status states
  const [transformerStatus, setTransformerStatus] = useState({light: 'on', text: '1kV POWER ON'});
  const [mainICStatus, setMainICStatus] = useState({light: 'on', text: 'CLOSED'});
  const [splitter1Status, setSplitter1Status] = useState({light: 'on', text: 'CLOSED'});
  const [splitter2Status, setSplitter2Status] = useState({light: 'on', text: 'CLOSED'});
  const [eb1Status, setEb1Status] = useState({light: 'on', text: 'CLOSED'});
  const [eb2Status, setEb2Status] = useState({light: 'on', text: 'CLOSED'});
  const [dg1Status, setDg1Status] = useState({light: '', text: 'OPEN'});
  const [dg2Status, setDg2Status] = useState({light: '', text: 'OPEN'});
  const [busCoupler1StatusDisplay, setBusCoupler1StatusDisplay] = useState({light: '', text: 'OPEN'});
  const [busCoupler2StatusDisplay, setBusCoupler2StatusDisplay] = useState({light: '', text: 'OPEN'});
  const [lt1Status, setLt1Status] = useState({light: 'on', text: 'LIVE (EB-1)'});
  const [lt2Status, setLt2Status] = useState({light: 'on', text: 'LIVE (EB-2)'});
  const [isDGRunning, setIsDGRunning] = useState(false);

  
  // Timer refs
  const dgMeterIntervalRef = useRef(null);
  const dg1TimerRef = useRef(null);
  const dg2TimerRef = useRef(null);
  const eb1TimerRef = useRef(null);
  const eb2TimerRef = useRef(null);
  const busCoupler1TimerRef = useRef(null);
  const busCoupler2TimerRef = useRef(null);

  // DG meter state
  const [dgMeter, setDgMeter] = useState({voltage: 0, frequency: 0, visible: false});

  // Helper functions
  const logEvent = (message, type = 'info') => {
    const time = new Date().toLocaleTimeString();
    const newEntry = {time, message, type};
    setEventLog(prevLog => [newEntry, ...prevLog]);
  };

  const updateStatus = (setter, lightState, text) => {
    setter({light: lightState, text});
  };

  const startTimer = (duration, setter, onComplete) => {
    let timer = duration;
    setter(timer);
    
    const intervalId = setInterval(() => {
      timer -= 1;
      setter(timer);
      
      if (timer < 0) {
        clearInterval(intervalId);
        onComplete();
      }
    }, 1000);
    
    return intervalId;
  };

  const clearAllTimers = () => {
    if (dgMeterIntervalRef.current) clearInterval(dgMeterIntervalRef.current);
    if (dg1TimerRef.current) clearInterval(dg1TimerRef.current);
    if (dg2TimerRef.current) clearInterval(dg2TimerRef.current);
    if (eb1TimerRef.current) clearInterval(eb1TimerRef.current);
    if (eb2TimerRef.current) clearInterval(eb2TimerRef.current);
    if (busCoupler1TimerRef.current) clearInterval(busCoupler1TimerRef.current);
    if (busCoupler2TimerRef.current) clearInterval(busCoupler2TimerRef.current);
  };

  const resetSystem = () => {
    if (isSimulating) return;
    
    clearAllTimers();
    setIsSimulating(false);
    setIsEB_ON(true);
    setIsEB1_ON(true);
    setIsEB2_ON(true);
    setIsDG1_ON(false);
    setIsDG2_ON(false);
    
    updateStatus(setTransformerStatus, 'on', '1kV POWER ON');
    updateStatus(setMainICStatus, 'on', 'CLOSED');
    updateStatus(setSplitter1Status, 'on', 'CLOSED');
    updateStatus(setSplitter2Status, 'on', 'CLOSED');
    updateStatus(setEb1Status, 'on', 'CLOSED');
    updateStatus(setEb2Status, 'on', 'CLOSED');
    updateStatus(setDg1Status, '', 'OPEN');
    updateStatus(setDg2Status, '', 'OPEN');
    
    updateStatus(setBusCoupler1StatusDisplay, '', 'OPEN');
    updateStatus(setBusCoupler2StatusDisplay, '', 'OPEN');
    setBusCoupler1Status('open');
    setBusCoupler2Status('open');
    
    updateStatus(setLt1Status, 'on', 'LIVE (EB-1)');
    updateStatus(setLt2Status, 'on', 'LIVE (EB-2)');
    
    setDgMeter({voltage: 0, frequency: 0, visible: false});
    
    // Reset timers
    setDg1Timer(0);
    setDg2Timer(0);
    setEb1Timer(0);
    setEb2Timer(0);
    setBusCoupler1Timer(0);
    setBusCoupler2Timer(0);
    
    setEventLog([]);
    logEvent('System initialized in normal operation mode. All supplies are active.', 'info');
  };

  // Bus Coupler functions
  const closeBusCoupler1 = () => {
    if (busCoupler1Status === 'closed') return;
    setBusCoupler1Status('closed');
    updateStatus(setBusCoupler1StatusDisplay, 'on', 'CLOSED');
    logEvent('Bus Coupler-1 closed (connected).', 'success');
  };

  const closeBusCoupler2 = () => {
    if (busCoupler2Status === 'closed') return;
    setBusCoupler2Status('closed');
    updateStatus(setBusCoupler2StatusDisplay, 'on', 'CLOSED');
    logEvent('Bus Coupler-2 closed (connected).', 'success');
  };

  const openBusCoupler1 = () => {
    if (busCoupler1Status === 'open') return;
    if (isDG1_ON || isDG2_ON && (!isEB1_ON && !isEB2_ON)) {
      const ltSetter = isDG1_ON ? setLt2Status : setLt1Status;
      setBusCoupler1Status('open');
      updateStatus(setBusCoupler1StatusDisplay, 'off', 'OPEN');
      updateStatus(ltSetter, 'off', 'NO SUPPLY');
      logEvent('Bus Coupler-1 opened (isolated).', 'info');  
    } else if (isEB1_ON || isEB2_ON && !(!isDG1_ON && !isDG2_ON)) {
      const ltSetter = isEB1_ON ? setLt2Status : setLt1Status;
      setBusCoupler1Status('open');
      updateStatus(setBusCoupler1StatusDisplay, 'off', 'OPEN');
      updateStatus(ltSetter, 'off', 'NO SUPPLY');
      logEvent('Bus Coupler-1 opened (isolated).', 'info');
    }
  };

  const openBusCoupler2 = () => {
    if (busCoupler2Status === 'open') return;
    if (isDG1_ON || isDG2_ON && (!isEB1_ON && !isEB2_ON)) {
      const ltSetter = isDG1_ON ? setLt2Status : setLt1Status;
      setBusCoupler2Status('open');
      updateStatus(setBusCoupler2StatusDisplay, 'off', 'OPEN');
      updateStatus(ltSetter, 'off', 'NO SUPPLY');
      logEvent('Bus Coupler-2 opened (isolated).', 'info');
    } else if (isEB1_ON || isEB2_ON && !(!isDG1_ON && !isDG2_ON)) {
      const ltSetter = isEB1_ON ? setLt2Status : setLt1Status;
      setBusCoupler2Status('open');
      updateStatus(setBusCoupler2StatusDisplay, 'off', 'OPEN');
      updateStatus(ltSetter, 'off', 'NO SUPPLY');
      logEvent('Bus Coupler-2 opened (isolated).', 'info');
    }
    
  };

  // Failure simulation functions
  const simulateTotalEBFail = () => {
    if (isSimulating || !isEB_ON) return;
    setIsSimulating(true);
    logEvent('Simulating total EB power failure from grid...', 'error');

    updateStatus(setTransformerStatus, 'off', 'NO SUPPLY');
    updateStatus(setMainICStatus, 'off', 'CLOSED(NO SUPPLY)');
    updateStatus(setSplitter1Status, 'off', 'CLOSED(NO SUPPLY)');
    updateStatus(setSplitter2Status, 'off', 'CLOSED(NO SUPPLY)');
    updateStatus(setEb1Status, 'off', 'TRIPPED OPEN');
    updateStatus(setEb2Status, 'off', 'TRIPPED OPEN');
    updateStatus(setLt1Status, 'off', 'NO SUPPLY');
    updateStatus(setLt2Status, 'off', 'NO SUPPLY');
    
    setIsEB_ON(false);
    setIsEB1_ON(false);
    setIsEB2_ON(false);
    
    logEvent('All EB incomers have opened. Both LT Panels are de-energized.', 'info');

    const selectedDG = currentDG;
    const dgLightSetter = selectedDG === 'DG-1' ? setDg1Status : setDg2Status;
    const dgTimerSetter = selectedDG === 'DG-1' ? setDg1Timer : setDg2Timer;
    const ltLoadSetter = selectedDG === 'DG-1' ? setLt1Status : setLt2Status;
    const dgStatusSetter = selectedDG === 'DG-1' ? setIsDG1_ON : setIsDG2_ON;

    updateStatus(dgLightSetter, 'standby', 'STARTING...');
    logEvent(`${selectedDG} received start signal. DG is starting...`, 'info');
    
    setDgMeter({voltage: 0, frequency: 0, visible: true});
    
    // Start DG meter simulation
    dgMeterIntervalRef.current = setInterval(() => {
      setDgMeter(prev => ({
        voltage: Math.min(prev.voltage + 41.5, 415),
        frequency: Math.min(prev.frequency + 5, 50),
        visible: true
      }));
    }, 1000);

    // Start DG timer
    dg1TimerRef.current = startTimer(10, dgTimerSetter, () => {
      clearInterval(dgMeterIntervalRef.current);
      setDgMeter(prev => ({...prev, visible: false}));
      
      updateStatus(dgLightSetter, 'on', 'CLOSED');
      updateStatus(ltLoadSetter, 'on', `LIVE (${selectedDG})`);
      logEvent(`${selectedDG} voltage stable. DG Incomer ACB closed. Respective LT Panel restored.`, 'success');
      
      dgStatusSetter(true);
      
      // Close bus couplers in sequence
      if (selectedDG === 'DG-1') {
        busCoupler1TimerRef.current = startTimer(9, setBusCoupler1Timer, () => {
          closeBusCoupler1();
          
          busCoupler2TimerRef.current = startTimer(9, setBusCoupler2Timer, () => {
            closeBusCoupler2();
            updateStatus(setLt2Status, 'on', `LIVE (${selectedDG})`);
            logEvent('Both Bus Couplers closed. Both LT Panels restored with DG supply.', 'success');
            setIsSimulating(false);
          });
        });
      } else {
        busCoupler2TimerRef.current = startTimer(9, setBusCoupler2Timer, () => {
          closeBusCoupler2();
          
          busCoupler1TimerRef.current = startTimer(9, setBusCoupler1Timer, () => {
            closeBusCoupler1();
            updateStatus(setLt1Status, 'on', `LIVE (${selectedDG})`);
            logEvent('Both Bus Couplers closed. Both LT Panels restored with DG supply.', 'success');
            setIsSimulating(false);
          });
        });
      }
    });
  };

  const simulateEB1Failure = () => {
    if (isSimulating || !isEB1_ON || !isEB2_ON) return;
    setIsSimulating(true);
    logEvent('Simulating EB-1 power failure...', 'error');
    
    updateStatus(setEb1Status, 'off', 'TRIPPED OPEN');
    updateStatus(setLt1Status, 'off', 'NO SUPPLY');
    setIsEB1_ON(false);
    
    logEvent('EB-1 Incomer has opened due to power failure. LT Panel-1 is de-energized.', 'info');

    busCoupler2TimerRef.current = startTimer(10, setBusCoupler2Timer, () => {
      closeBusCoupler2();
      
      busCoupler1TimerRef.current = startTimer(2, setBusCoupler1Timer, () => {
        closeBusCoupler1();
        updateStatus(setLt1Status, 'on', 'LIVE (EB-2 via Bus Coupler)');
        logEvent('Bus Couplers are successfully closed. LT Panel-1 is now powered by EB-2.', 'success');
        setIsSimulating(false);
      });
    });
  };

  const simulateEB2Failure = () => {
    if (isSimulating || !isEB2_ON || !isEB1_ON) return;
    setIsSimulating(true);
    logEvent('Simulating EB-2 power failure...', 'error');
    
    updateStatus(setEb2Status, 'off', 'TRIPPED OPEN');
    updateStatus(setLt2Status, 'off', 'NO SUPPLY');
    setIsEB2_ON(false);
    
    logEvent('EB-2 Incomer has opened due to power failure. LT Panel-2 is de-energized.', 'info');

    busCoupler1TimerRef.current = startTimer(10, setBusCoupler1Timer, () => {
      closeBusCoupler1();
      
      busCoupler2TimerRef.current = startTimer(2, setBusCoupler2Timer, () => {
        closeBusCoupler2();
        updateStatus(setLt2Status, 'on', 'LIVE (EB-1 via Bus Coupler)');
        logEvent('Bus Couplers are successfully. LT Panel-2 is now powered by EB-1.', 'success');
        setIsSimulating(false);
      });
    });
  };

  const simulateEBRestore = () => {
    if (isSimulating || (isEB1_ON && isEB2_ON)) return;
    setIsSimulating(true);
    logEvent('Simulating EB supply restoration (5-step sequence)...', 'success');

    // Complex restoration logic would go here
    // This is a simplified version for demonstration
    
    if (isDG1_ON || isDG2_ON) {
      const selectedDG = isDG1_ON ? 'DG-1' : 'DG-2';
      
      updateStatus(setTransformerStatus, 'on', '1kV POWER ON');
      updateStatus(setMainICStatus, 'on', 'CLOSED');
      updateStatus(setSplitter1Status, 'on', 'CLOSED');
      updateStatus(setSplitter2Status, 'on', 'CLOSED');
      logEvent('Transformer and Main I/C online. Executing restore sequence (DG running).', 'info');

      if (isDG2_ON && !isDG1_ON) {
      // Simplified restoration process
      busCoupler1TimerRef.current = startTimer(4, setBusCoupler1Timer, () => {
        openBusCoupler1();
        updateStatus(setLt1Status, 'off', 'NO SUPPLY');
        logEvent('Step1: BC-1 opened. LT-1 -> NO SUPPLY.', 'info');

        busCoupler2TimerRef.current = startTimer(2, setBusCoupler2Timer, () => {
          openBusCoupler2();
          logEvent('Step3: BC-2 opened. DG-side LT remains on DG supply.', 'info');

          eb1TimerRef.current = startTimer(5, setEb1Timer, () => {
            updateStatus(setEb1Status, 'on', 'CLOSED');
            setIsEB1_ON(true);
            updateStatus(setLt1Status, 'on', 'LIVE (EB-1)');
            logEvent('Step2: EB-1 closed. LT-1 restored to EB-1.', 'success');

            const dgTimerSetter = selectedDG === 'DG-1' ? setDg1Timer : setDg2Timer;
            dg2TimerRef.current = startTimer(180, dgTimerSetter, () => {
              const dgStatusSetter = selectedDG === 'DG-1' ? setDg1Status : setDg2Status;
              const dgStateSetter = selectedDG === 'DG-1' ? setIsDG1_ON : setIsDG2_ON;
              const ltSetter = selectedDG === 'DG-1' ? setLt1Status : setLt2Status;
              
              updateStatus(dgStatusSetter, '', 'OPEN');
              logEvent('Step4: DG incomer stopped. DG-side LT -> NO SUPPLY.', 'info');
              updateStatus(ltSetter, 'off', 'NO SUPPLY');
              dgStateSetter(false);

              const ebTimerSetter = selectedDG === 'DG-1' ? setEb1Timer : setEb2Timer;
              eb2TimerRef.current = startTimer(2, ebTimerSetter, () => {
                const ebStatusSetter = selectedDG === 'DG-1' ? setEb1Status : setEb2Status;
                const ebStateSetter = selectedDG === 'DG-1' ? setIsEB1_ON : setIsEB2_ON;
                
                updateStatus(ebStatusSetter, 'on', 'CLOSED');
                ebStateSetter(true);
                updateStatus(ltSetter, 'on', `LIVE (EB-${selectedDG === 'DG-1' ? '1' : '2'})`);
                logEvent('Step5: EB on DG side closed and DG-side LT restored to EB.', 'success');

                setBusCoupler1Status('open');
                setBusCoupler2Status('open');
                setIsSimulating(false);
                resetSystem();
              });
            });
          });
        });
      })} else if (isDG1_ON && !isDG2_ON) {
        busCoupler2TimerRef.current = startTimer(4, setBusCoupler2Timer, () => {
        openBusCoupler2();
        updateStatus(setLt2Status, 'off', 'NO SUPPLY');
        logEvent('Step1: BC-1 opened. LT-1 -> NO SUPPLY.', 'info');

        busCoupler1TimerRef.current = startTimer(2, setBusCoupler1Timer, () => {
          openBusCoupler1();
          logEvent('Step3: BC-2 opened. DG-side LT remains on DG supply.', 'info');

          eb2TimerRef.current = startTimer(5, setEb2Timer, () => {
            updateStatus(setEb2Status, 'on', 'CLOSED');
            setIsEB2_ON(true);
            updateStatus(setLt2Status, 'on', 'LIVE (EB-1)');
            logEvent('Step2: EB-1 closed. LT-1 restored to EB-1.', 'success');

            const dgTimerSetter = selectedDG === 'DG-1' ? setDg1Timer : setDg2Timer;
            dg1TimerRef.current = startTimer(180, dgTimerSetter, () => {
              const dgStatusSetter = selectedDG === 'DG-1' ? setDg1Status : setDg2Status;
              const dgStateSetter = selectedDG === 'DG-1' ? setIsDG1_ON : setIsDG2_ON;
              const ltSetter = selectedDG === 'DG-1' ? setLt1Status : setLt2Status;
              
              updateStatus(dgStatusSetter, '', 'OPEN');
              logEvent('Step4: DG incomer stopped. DG-side LT -> NO SUPPLY.', 'info');
              updateStatus(ltSetter, 'off', 'NO SUPPLY');
              dgStateSetter(false);

              const ebTimerSetter = selectedDG === 'DG-1' ? setEb1Timer : setEb2Timer;
              eb1TimerRef.current = startTimer(2, ebTimerSetter, () => {
                const ebStatusSetter = selectedDG === 'DG-1' ? setEb1Status : setEb2Status;
                const ebStateSetter = selectedDG === 'DG-1' ? setIsEB1_ON : setIsEB2_ON;
                
                updateStatus(ebStatusSetter, 'on', 'CLOSED');
                ebStateSetter(true);
                updateStatus(ltSetter, 'on', `LIVE (EB-${selectedDG === 'DG-1' ? '1' : '2'})`);
                logEvent('Step5: EB on DG side closed and DG-side LT restored to EB.', 'success');

                setBusCoupler1Status('open');
                setBusCoupler2Status('open');
                setIsSimulating(false);
                resetSystem();
              });
            });
          });
        });
      })
      };
    } else {
      // No DG running - simple restore
      if (!isEB1_ON) {
        busCoupler1TimerRef.current = startTimer(2, setBusCoupler1Timer, () => {
          openBusCoupler1();
          updateStatus(setLt1Status, 'off', 'NO SUPPLY');
        });
        busCoupler2TimerRef.current = startTimer(4, setBusCoupler2Timer, () => {
          openBusCoupler2();
        });

        logEvent('Bus Coupler-1 opened.', 'info');

        eb1TimerRef.current = startTimer(5, setEb1Timer, () => {
          updateStatus(setEb1Status, 'on', 'CLOSED');
          updateStatus(setLt1Status, 'on', 'LIVE (EB-1)');
          logEvent('EB-1 Incomer closed. LT-1 restored to EB-1.', 'success');
          setIsEB1_ON(true);
          setIsSimulating(false);
          resetSystem();
        });
      } else if (!isEB2_ON) {
        busCoupler2TimerRef.current = startTimer(2, setBusCoupler2Timer, () => {
          openBusCoupler2();
          updateStatus(setLt2Status, 'off', 'NO SUPPLY');
        });
        busCoupler1TimerRef.current = startTimer(4, setBusCoupler1Timer, () => {
          openBusCoupler1();
        });
        logEvent('Bus Coupler-2 opened.', 'info');

        eb2TimerRef.current = startTimer(5, setEb2Timer, () => {
          updateStatus(setEb2Status, 'on', 'CLOSED');
          updateStatus(setLt2Status, 'on', 'LIVE (EB-2)');
          logEvent('EB-2 Incomer closed. LT-2 restored to EB-2.', 'success');
          setIsEB2_ON(true);
          setIsSimulating(false);
          resetSystem();
        });
      }
    }
  };

  // Manual mode handlers
  const handleManualStartDG = () => {
    if (isSimulating) return;
    setIsSimulating(true);
    
    updateStatus(setTransformerStatus, 'off', 'NO SUPPLY');
    updateStatus(setMainICStatus, 'off', 'CLOSED(NO SUPPLY)');
    updateStatus(setSplitter1Status, 'off', 'CLOSED(NO SUPPLY)');
    updateStatus(setSplitter2Status, 'off', 'CLOSED(NO SUPPLY)');
    updateStatus(setEb1Status, 'off', 'TRIPPED OPEN');
    updateStatus(setEb2Status, 'off', 'TRIPPED OPEN');
    updateStatus(setLt1Status, 'off', 'NO SUPPLY');
    updateStatus(setLt2Status, 'off', 'NO SUPPLY');

    const dgLightSetter = currentDG === 'DG-1' ? setDg1Status : setDg2Status;
    const dgTimerSetter = currentDG === 'DG-1' ? setDg1Timer : setDg2Timer;
    const ltSetter = currentDG === 'DG-1' ? setLt1Status : setLt2Status;
    const dgStateSetter = currentDG === 'DG-1' ? setIsDG1_ON : setIsDG2_ON;

    updateStatus(dgLightSetter, 'standby', 'STARTING...');
    updateStatus(ltSetter, 'CLOSE', `Restoring with ${currentDG}`);
    logEvent(`Manually starting ${currentDG}...`, 'info');
    
    setDgMeter({voltage: 0, frequency: 0, visible: true});
    
    dgMeterIntervalRef.current = setInterval(() => {
      setDgMeter(prev => ({
        voltage: Math.min(prev.voltage + 41.5, 415),
        frequency: Math.min(prev.frequency + 5, 50),
        visible: true
      }));
    }, 500);

    dg1TimerRef.current = startTimer(10, dgTimerSetter, () => {
      clearInterval(dgMeterIntervalRef.current);
      setDgMeter(prev => ({...prev, visible: false}));
      logEvent(`${currentDG} is now stable and ready for operation.`, 'info');
      dgStateSetter(true);
      setIsSimulating(false);
    });
  };

  const handleManualCloseDGAcb = () => {
    if (isSimulating || (!isDG1_ON && !isDG2_ON)) return;
    setIsSimulating(true);
    
    const dgLightSetter = isDG1_ON ? setDg1Status : setDg2Status;
    const ltSetter = isDG1_ON ? setLt1Status : setLt2Status;
    
    updateStatus(dgLightSetter, 'on', 'CLOSED');
    updateStatus(ltSetter, 'on', `LIVE (${currentDG})`);
    logEvent(`Manually closed ${currentDG} Incomer ACB. LT-1 restored.`, 'success');
    setIsSimulating(false);
  };

  // Additional manual mode handlers would go here

  // Clean up on unmount
  useEffect(() => {
    return () => {
      clearAllTimers();
    };
  }, []);

  // Render the component
  return (
    <div className="dhr-dashboard-container">
      <h1>Asansol MSC LT Panel Operation Simulator - V12</h1>
      <p style={{textAlign: 'center'}}>This model demonstrates the system's logic for automatic and manual changeovers. Timers are visible for every timed action.</p>

      <div className="mode-switch">
        <label>Operation Mode:</label>
        <input 
          type="radio" 
          id="autoMode" 
          name="opMode" 
          value="auto" 
          checked={operationMode === 'auto'} 
          onChange={() => setOperationMode('auto')} 
        />
        <label htmlFor="autoMode">Auto</label>
        <input 
          type="radio" 
          id="manualMode" 
          name="opMode" 
          value="manual" 
          checked={operationMode === 'manual'} 
          onChange={() => setOperationMode('manual')} 
        />
        <label htmlFor="manualMode">Manual</label>
      </div>

      <div className="opdashboard">
        <div className="panel">
          <h3>Transformer</h3>
          <div className={`status-light ${transformerStatus.light}`}></div>
          <p>{transformerStatus.text}</p>
        </div>

        <div className="panel">
          <h3>WBSEDCL Main I/C</h3>
          <div className={`status-light ${mainICStatus.light}`}></div>
          <p>{mainICStatus.text}</p>
        </div>

        <div className="panel">
          <h3>Splitter Pane-I</h3>
          <div className={`status-light ${splitter1Status.light}`}></div>
          <p>{splitter1Status.text}</p>
        </div>

        <div className="panel">
          <h3>Splitter Panel-II</h3>
          <div className={`status-light ${splitter2Status.light}`}></div>
          <p>{splitter2Status.text}</p>
        </div>

        <div className="panel">
          <h3>EB-1 Incomer (LT-1)</h3>
          <div className={`status-light ${eb1Status.light}`}></div>
          <p>{eb1Status.text}</p>
          <div className="timer-container" style={{display: eb1Timer > 0 ? 'block' : 'none'}}>
            Timer: <span className="timer-display">{eb1Timer}</span>s
          </div>
        </div>

        <div className="panel">
          <h3>EB-2 Incomer (LT-2)</h3>
          <div className={`status-light ${eb2Status.light}`}></div>
          <p>{eb2Status.text}</p>
          <div className="timer-container" style={{display: eb2Timer > 0 ? 'block' : 'none'}}>
            Timer: <span className="timer-display">{eb2Timer}</span>s
          </div>
        </div>

        <div className="panel">
          <h3>DG-1 Incomer (LT-1)</h3>
          <div className={`status-light ${dg1Status.light}`}></div>
          <p>{dg1Status.text}</p>
          <div className="timer-container" style={{display: dg1Timer > 0 ? 'block' : 'none'}}>
            Timer: <span className="timer-display">{dg1Timer}</span>s
          </div>
        </div>

        <div className="panel">
          <h3>DG-2 Incomer (LT-2)</h3>
          <div className={`status-light ${dg2Status.light}`}></div>
          <p>{dg2Status.text}</p>
          <div className="timer-container" style={{display: dg2Timer > 0 ? 'block' : 'none'}}>
            Timer: <span className="timer-display">{dg2Timer}</span>s
          </div>
        </div>

        <div className="panel">
          <h3>Bus Coupler-1 (LT Panel-1)</h3>
          <div className={`status-light ${busCoupler1StatusDisplay.light}`}></div>
          <p>{busCoupler1StatusDisplay.text}</p>
          <div className="timer-container" style={{display: busCoupler1Timer > 0 ? 'block' : 'none'}}>
            Timer: <span className="timer-display">{busCoupler1Timer}</span>s
          </div>
        </div>

        <div className="panel">
          <h3>Bus Coupler-2 (LT Panel-2)</h3>
          <div className={`status-light ${busCoupler2StatusDisplay.light}`}></div>
          <p>{busCoupler2StatusDisplay.text}</p>
          <div className="timer-container" style={{display: busCoupler2Timer > 0 ? 'block' : 'none'}}>
            Timer: <span className="timer-display">{busCoupler2Timer}</span>s
          </div>
        </div>

        <div className="panel">
          <h3>LT Panel-1 Load</h3>
          <div className={`status-light ${lt1Status.light}`}></div>
          <p>{lt1Status.text}</p>
        </div>

        <div className="panel">
          <h3>LT Panel-2 Load</h3>
          <div className={`status-light ${lt2Status.light}`}></div>
          <p>{lt2Status.text}</p>
        </div>
      </div>

      <div className="controls">
        {operationMode === 'auto' && (
          <div className="control-group" id="autoControls">
            <h3>Auto Mode Controls</h3>
            <label htmlFor="dgSelector">DG for Auto Operation:</label>
            <select 
              id="dgSelector" 
              value={currentDG} 
              onChange={(e) => setCurrentDG(e.target.value)}
              disabled={isSimulating}
            >
              <option value="DG-1">DG-1</option>
              <option value="DG-2">DG-2</option>
            </select>
            {dgMeter.visible && (
              <div className="digital-meter" id="dgMeter">
                Voltage: {dgMeter.voltage.toFixed(1)}V | Frequency: {dgMeter.frequency.toFixed(1)}Hz
              </div>
            )}
            <br />
            <button 
              id="simulateTotalEBfail" 
              className="action-button critical"
              onClick={simulateTotalEBFail}
              disabled={isSimulating || !(isEB1_ON && isEB2_ON && !isDG1_ON && !isDG2_ON)}
            >
              Simulate TOTAL EB Failure
            </button>
            <button 
              id="simulateEB1fail" 
              className="action-button"
              onClick={simulateEB1Failure}
              disabled={isSimulating || !(isEB1_ON && isEB2_ON && !isDG1_ON && !isDG2_ON)}
            >
              Simulate EB-1 Failure
            </button>
            <button 
              id="simulateEB2fail" 
              className="action-button"
              onClick={simulateEB2Failure}
              disabled={isSimulating || !(isEB1_ON && isEB2_ON && !isDG1_ON && !isDG2_ON)}
            >
              Simulate EB-2 Failure
            </button>
            <br />
            <button 
              id="simulateEBrestore" 
              className="action-button success"
              onClick={simulateEBRestore}
              disabled={isSimulating || (isEB1_ON && isEB2_ON)}
            >
              Simulate EB Restoration
            </button>
            <button 
              id="reset" 
              className="action-button"
              onClick={resetSystem}
              disabled={isSimulating}
            >
              Reset System
            </button>
          </div>
        )}

        {/* Manual Mode Controls */}
        {operationMode === 'manual' && (
          <div className="control-group manual-buttons-container" id="manualControls">
            <h3>Manual Mode Controls</h3>
            <label htmlFor="manualDGSelector">Select DG:</label>
            <select 
              id="manualDGSelector" 
              value="" 
              onChange={(e) => setCurrentDG(e.target.value)}
            >
              <option value="DG-1">DG-1</option>
              <option value="DG-2">DG-2</option>
            </select>
            <br />

            {/* EB → DG Transition */}
            <button id="manualOpenEB1" 
              className="action-button"
              onClick={() => {
                updateStatus(setTransformerStatus, 'off', 'NO SUPPLY');
                updateStatus(setMainICStatus, 'off', 'CLOSED(NO SUPPLY)');
                updateStatus(setSplitter1Status, 'off', 'CLOSED(NO SUPPLY)');
                updateStatus(setSplitter2Status, 'off', 'CLOSED(NO SUPPLY)');
                updateStatus(setEb1Status, 'off', 'TRIPPED OPEN');
                setIsEB1_ON(false);
                setIsEB2_ON(false);
                updateStatus(setEb2Status, 'off', 'TRIPPED OPEN');
                updateStatus(setLt1Status, 'off', 'NO SUPPLY');
                updateStatus(setLt2Status, 'off', 'NO SUPPLY');
                logEvent('Total EB Supply Fail ACB opened manually.', 'info');
                setIsEB_ON(false);
              }}
              disabled={isSimulating || !isEB1_ON || !isEB2_ON || isDG1_ON || isDG2_ON}
            >
              EB Supply Failure
            </button>
            {/* <button 
              id="manualOpenEB1" 
              className="action-button"
              onClick={() => {
                updateStatus(setEb1Status, 'off', 'OPEN');
                setIsEB1_ON(false);
                updateStatus(setLt1Status, 'off', 'NO SUPPLY');
                logEvent('EB-1 ACB opened manually.', 'info');
              }}
              disabled={isSimulating || !isEB1_ON || isDG1_ON || isDG2_ON}
            >
              Open EB-1 ACB
            </button> */}
            {/* <button 
              id="manualOpenEB2" 
              className="action-button"
              onClick={() => {
                updateStatus(setEb2Status, 'off', 'OPEN');
                setIsEB2_ON(false);
                updateStatus(setLt2Status, 'off', 'NO SUPPLY');
                logEvent('EB-2 ACB opened manually.', 'info');
              }}
              disabled={isSimulating || !isEB2_ON || isDG1_ON || isDG2_ON || isEB1_ON}
            >
              Open EB-2 ACB
            </button> */}
            <button 
              id="manualStartDG" 
              className="action-button"
              onClick={() => {
                const selectedDG = currentDG;
                const dgLightSetter = selectedDG === 'DG-1' ? setDg1Status : setDg2Status;
                updateStatus(dgLightSetter, 'standby', 'STARTING...');
                logEvent(`Started ${currentDG} manually from local panel.`, 'info');
                setIsDGRunning(true); // ✅ Track DG running
              }}
              disabled={isSimulating || isDG1_ON || isDG2_ON || isEB1_ON || isEB2_ON || isDGRunning}
            >
              Start DG
            </button>
            <button 
              id="manualCloseDGAcb" 
              className="action-button"
              onClick={() => {
                const dgLightSetter = currentDG === 'DG-1' ? setDg1Status : setDg2Status;
                const ltSetter = currentDG === 'DG-1' ? setLt1Status : setLt2Status;
                const dgStateSetter = currentDG === 'DG-1' ? setIsDG1_ON : setIsDG2_ON;

                updateStatus(dgLightSetter, 'on', 'CLOSED');
                updateStatus(ltSetter, 'on', `LIVE (${currentDG})`);
                dgStateSetter(true);
                logEvent(`${currentDG} Incomer ACB closed manually.`, 'success');
              }}
              disabled={isSimulating || isEB1_ON || isEB2_ON || !isDGRunning || (isDG1_ON || isDG2_ON)}
            >
              Close DG Incomer ACB
            </button>

            {/* Close Bus Couplers */}
            <button 
              id="manualCloseBusCoupler1" 
              className="action-button"
              onClick={() => {
                closeBusCoupler1();
                if (currentDG === 'DG-2' && busCoupler2Status === 'closed') {
                  updateStatus(setLt1Status, 'on', 'LIVE (DG-2)');
                }
              }}
              disabled={
                isSimulating || busCoupler1Status === 'closed' || (!isDG1_ON && !isDG2_ON) ||
                (currentDG === 'DG-2' && busCoupler2Status === 'open')
              }
            >
              Close Bus Coupler-1
            </button>
            <button 
              id="manualCloseBusCoupler2" 
              className="action-button"
              onClick={() => {
                closeBusCoupler2();
                if (currentDG === 'DG-1' && busCoupler1Status === 'closed') {
                  updateStatus(setLt2Status, 'on', 'LIVE (DG-1)');
                }
              }}
              disabled={
                isSimulating || busCoupler2Status === 'closed' || (!isDG1_ON && !isDG2_ON) ||
                (currentDG === 'DG-1' && busCoupler1Status === 'open')
              }
            >
              Close Bus Coupler-2
            </button>

            <hr />
            <h4>DG → EB Transition</h4>

            {/* Open Bus Couplers */}
            <button id="manualOpenEB1" 
              className="action-button"
              onClick={() => {
                updateStatus(setTransformerStatus, 'on', '11kV POWER ON');
                updateStatus(setMainICStatus, 'on', 'CLOSED');
                updateStatus(setSplitter1Status, 'on', 'CLOSED');
                updateStatus(setSplitter2Status, 'on', 'CLOSED');
                logEvent('Total EB Supply restore.', 'info');
                setIsEB_ON(true);
              }}
              disabled={isSimulating || isEB1_ON || isEB2_ON || !isDGRunning}
            >
              EB Supply Restore
            </button>
            <button 
              id="manualOpenBusCoupler1" 
              className="action-button"
              onClick={openBusCoupler1}
              disabled={isSimulating || busCoupler1Status === 'open'}
            >
              Open Bus Coupler-1
            </button>
            <button 
              id="manualOpenBusCoupler2" 
              className="action-button"
              onClick={openBusCoupler2}
              disabled={isSimulating || busCoupler2Status === 'open'}
            >
              Open Bus Coupler-2
            </button>

            {/* Open DG ACB */}
            <button 
              id="manualOpenDGAcb" 
              className="action-button"
              onClick={() => {
                const dgLightSetter = isDG1_ON ? setDg1Status : setDg2Status;
                updateStatus(dgLightSetter, 'off', 'OPEN');
                updateStatus(setLt1Status, 'off', 'NO SUPPLY');
                updateStatus(setLt2Status, 'off', 'NO SUPPLY');
                logEvent(`Manually opened ${currentDG} Incomer ACB.`, 'info');

                // ✅ Update DG running state to false
                if (isDG1_ON) setIsDG1_ON(false);
                if (isDG2_ON) setIsDG2_ON(false);
              }}
              disabled={isSimulating || (!isDG1_ON && !isDG2_ON) || busCoupler1Status === 'closed' || busCoupler2Status === 'closed'}
            >
              Open DG Incomer ACB
            </button>

            {/* Close EB incomers */}
            <button 
              id="manualCloseEB1" 
              className="action-button"
              onClick={() => {
                updateStatus(setEb1Status, 'on', 'CLOSED');
                updateStatus(setLt1Status, 'on', 'LIVE (EB-1)');
                setIsEB1_ON(true);
                logEvent('EB-1 Incomer closed manually.', 'success');
              }}
              disabled={isSimulating || isEB1_ON || isDG1_ON || isDG2_ON}
            >
              Close EB-1 ACB
            </button>
            <button 
              id="manualCloseEB2" 
              className="action-button"
              onClick={() => {
                updateStatus(setEb2Status, 'on', 'CLOSED');
                updateStatus(setLt2Status, 'on', 'LIVE (EB-2)');
                setIsEB2_ON(true);
                logEvent('EB-2 Incomer closed manually.', 'success');
              }}
              disabled={isSimulating || isEB2_ON || isDG1_ON || isDG2_ON || !isEB1_ON}
            >
              Close EB-2 ACB
            </button>

            {/* Stop DG */}
            <button 
              id="manualStopDG" 
              className="action-button"
              onClick={() => {
                logEvent(`Stopped ${currentDG} manually from local panel.`, 'info');
                setIsDGRunning(false); // ✅ DG stopped
              }}
              disabled={isSimulating || !isDGRunning || !isEB1_ON || !isEB2_ON}
            >
              Stop DG
            </button>

            <div className="bc-controls">
              <small>Manual Bus Coupler controls (BC-1 ⇄ LT-1, BC-2 ⇄ LT-2)</small>
            </div>
          </div>
        )}
      </div>

      <div className="log-panel">
        <h3>System Event Log</h3>
        <div id="eventLog">
          {eventLog.map((entry, index) => (
            <div key={index} className={`log-entry ${entry.type}`}>
              <strong>[{entry.time}]</strong> {entry.message}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AsansolOperationSimulator;