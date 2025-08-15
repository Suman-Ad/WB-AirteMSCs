import React, { useState, useRef, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { Chart } from 'chart.js/auto';
import { saveAs } from 'file-saver';

const ThermalImageAnalysis = () => {
  const [image, setImage] = useState(null);
  const [measurements, setMeasurements] = useState([]);
  const [parameters, setParameters] = useState([]);
  const [locationInfo, setLocationInfo] = useState({});
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [activeTool, setActiveTool] = useState(null);
  const [spots, setSpots] = useState([]);
  const imageRef = useRef(null);
  const canvasRef = useRef(null);
  const chartRef = useRef(null);
  const chartInstance = useRef(null);

  // Tools
  const tools = [
    { id: 'spot', name: 'Spot Measurement' },
    { id: 'area', name: 'Area Analysis' },
    { id: 'line', name: 'Line Profile' }
  ];

  // Generate mock data matching your template
  const generateMockData = () => {
    return {
      location: "1st Floor Splitter Panel room Splitter Panel-1",
      measurements: [
        { name: "Sp1", value: 45.8, unit: "°C", x: 100, y: 150 },
        { name: "Sp2", value: 44.8, unit: "°C", x: 200, y: 150 },
        { name: "Sp3", value: 44.3, unit: "°C", x: 300, y: 150 },
        { name: "Sp4", value: 44.4, unit: "°C", x: 400, y: 150 },
        { name: "Sp5", value: 45.4, unit: "°C", x: 100, y: 250 },
        { name: "Sp6", value: 42.3, unit: "°C", x: 200, y: 250 },
        { name: "Sp7", value: 46.0, unit: "°C", x: 300, y: 250 },
        { name: "Sp8", value: 45.8, unit: "°C", x: 400, y: 250 }
      ],
      parameters: [
        { name: "Emissivity", value: 0.95, unit: "" },
        { name: "Refl. temp.", value: 20, unit: "°C" }
      ],
      note: "Splitter Panel-1 1600A"
    };
  };

  const { getRootProps, getInputProps } = useDropzone({
    accept: 'image/*',
    onDrop: (acceptedFiles) => {
      if (acceptedFiles.length === 0) return;
      
      setIsAnalyzing(true);
      const file = acceptedFiles[0];
      const reader = new FileReader();
      
      reader.onload = () => {
        setImage(reader.result);
        const mockData = generateMockData();
        setLocationInfo({
          title: mockData.location,
          note: mockData.note
        });
        setMeasurements(mockData.measurements);
        setParameters(mockData.parameters);
        setSpots(mockData.measurements);
        setIsAnalyzing(false);
      };
      
      reader.onerror = () => {
        console.error("File reading error");
        setIsAnalyzing(false);
      };
      
      reader.readAsDataURL(file);
    },
  });

  const handleImageClick = (e) => {
    if (!activeTool || !imageRef.current) return;
    
    const rect = imageRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    if (activeTool === 'spot') {
      const newSpot = {
        name: `SP${spots.length + 1}`,
        x,
        y,
        value: (Math.random() * 5 + 40).toFixed(1), // Simulated temp reading
        unit: '°C'
      };
      setSpots([...spots, newSpot]);
      setMeasurements([...measurements, newSpot]);
    }
  };

  const renderMeasurementMarkers = () => {
    if (!canvasRef.current || !imageRef.current || spots.length === 0) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const img = imageRef.current;
    
    // Set canvas dimensions to match image
    canvas.width = img.width;
    canvas.height = img.height;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw markers
    spots.forEach(spot => {
      // Draw crosshair
      ctx.strokeStyle = 'red';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(spot.x - 10, spot.y);
      ctx.lineTo(spot.x + 10, spot.y);
      ctx.moveTo(spot.x, spot.y - 10);
      ctx.lineTo(spot.x, spot.y + 10);
      ctx.stroke();
      
      // Draw label background
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.fillRect(spot.x + 15, spot.y - 20, 60, 20);
      
      // Draw text
      ctx.fillStyle = 'red';
      ctx.font = '12px Arial';
      ctx.fillText(`${spot.value}°C`, spot.x + 20, spot.y - 5);
    });
  };

  const renderTemperatureChart = () => {
    if (!chartRef.current || measurements.length === 0) return;

    if (chartInstance.current) {
      chartInstance.current.destroy();
    }

    const ctx = chartRef.current.getContext('2d');
    chartInstance.current = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: measurements.map(m => m.name),
        datasets: [{
          label: 'Temperature (°C)',
          data: measurements.map(m => m.value),
          backgroundColor: measurements.map(m => 
            m.value > 45 ? 'rgba(255, 99, 71, 0.7)' : 'rgba(54, 162, 235, 0.7)'
          ),
          borderColor: measurements.map(m => 
            m.value > 45 ? 'rgb(255, 99, 71)' : 'rgb(54, 162, 235)'
          ),
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            callbacks: {
              label: (context) => `${context.dataset.label}: ${context.raw}°C`
            }
          }
        },
        scales: {
          y: {
            beginAtZero: false,
            min: Math.min(...measurements.map(m => m.value)) - 2,
            max: Math.max(...measurements.map(m => m.value)) + 2,
            title: {
              display: true,
              text: 'Temperature (°C)'
            }
          }
        }
      }
    });
  };

  const exportData = () => {
    const data = {
      image,
      locationInfo,
      measurements,
      parameters,
      spots,
      timestamp: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'});
    saveAs(blob, 'thermal-analysis.json');
  };

  useEffect(() => {
    renderMeasurementMarkers();
    renderTemperatureChart();
  }, [spots, measurements]);

  const styles = {
    container: {
      fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
      maxWidth: '1000px',
      margin: '0 auto',
      padding: '20px'
    },
    header: {
      color: '#2c3e50',
      borderBottom: '2px solid #3498db',
      paddingBottom: '10px'
    },
    dropzone: {
      border: '2px dashed #7f8c8d',
      borderRadius: '8px',
      padding: '20px',
      textAlign: 'center',
      cursor: 'pointer',
      backgroundColor: '#f8f9fa',
      margin: '20px 0'
    },
    toolContainer: {
      display: 'flex',
      gap: '10px',
      margin: '10px 0'
    },
    toolButton: {
      padding: '8px 12px',
      backgroundColor: '#f0f0f0',
      border: '1px solid #ddd',
      borderRadius: '4px',
      cursor: 'pointer'
    },
    activeTool: {
      backgroundColor: '#3498db',
      color: 'white',
      borderColor: '#2980b9'
    },
    imageContainer: {
      position: 'relative',
      margin: '20px 0'
    },
    image: {
      maxWidth: '100%',
      maxHeight: '500px',
      display: 'block'
    },
    overlayCanvas: {
      position: 'absolute',
      top: 0,
      left: 0,
      pointerEvents: 'none'
    },
    section: {
      margin: '20px 0',
      padding: '15px',
      backgroundColor: '#fff',
      borderRadius: '8px',
      boxShadow: '0 2px 5px rgba(0,0,0,0.1)'
    },
    table: {
      width: '100%',
      borderCollapse: 'collapse',
      margin: '10px 0'
    },
    tableCell: {
      padding: '8px',
      borderBottom: '1px solid #ddd',
      textAlign: 'left'
    },
    tableHeader: {
      fontWeight: 'bold',
      backgroundColor: '#f2f2f2'
    },
    chartContainer: {
      height: '300px',
      margin: '20px 0'
    },
    button: {
      backgroundColor: '#3498db',
      color: 'white',
      border: 'none',
      padding: '10px 15px',
      borderRadius: '4px',
      cursor: 'pointer',
      marginTop: '10px'
    }
  };

  return (
    <div style={styles.container}>
      <h1 style={styles.header}>Thermal Analysis Tool</h1>
      
      <div {...getRootProps({style: styles.dropzone})}>
        <input {...getInputProps()} />
        <p>Drag & drop a thermal image here, or click to select</p>
      </div>

      {isAnalyzing && <p>Processing image...</p>}

      {image && (
        <>
          <div style={styles.toolContainer}>
            {tools.map(tool => (
              <button
                key={tool.id}
                style={{
                  ...styles.toolButton,
                  ...(activeTool === tool.id ? styles.activeTool : {})
                }}
                onClick={() => setActiveTool(activeTool === tool.id ? null : tool.id)}
              >
                {tool.name}
              </button>
            ))}
          </div>

          <div style={styles.imageContainer}>
            <img 
              ref={imageRef}
              src={image} 
              alt="Thermal" 
              style={styles.image}
              onClick={handleImageClick}
            />
            <canvas 
              ref={canvasRef}
              style={styles.overlayCanvas}
            />
          </div>

          <div style={styles.section}>
            <h2>Location: {locationInfo.title}</h2>
            <p>{locationInfo.note}</p>
          </div>

          <div style={styles.section}>
            <h2>Measurements</h2>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.tableHeader}>Point</th>
                  <th style={styles.tableHeader}>Temperature</th>
                  <th style={styles.tableHeader}>Coordinates</th>
                </tr>
              </thead>
              <tbody>
                {measurements.map((m, i) => (
                  <tr key={i}>
                    <td style={styles.tableCell}>{m.name}</td>
                    <td style={styles.tableCell}>{m.value} {m.unit}</td>
                    <td style={styles.tableCell}>{m.x ? `(${m.x}, ${m.y})` : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={styles.section}>
            <h2>Temperature Visualization</h2>
            <div style={styles.chartContainer}>
              <canvas ref={chartRef}></canvas>
            </div>
          </div>

          <button onClick={exportData} style={styles.button}>
            Export Report
          </button>
        </>
      )}
    </div>
  );
};

export default ThermalImageAnalysis;