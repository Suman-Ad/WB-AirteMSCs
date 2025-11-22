import React, { useState, useEffect } from 'react';

const StockAlertPage = ({ ticker }) => {
  const [stockData, setStockData] = useState(null);
  const [alertTriggered, setAlertTriggered] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      // 1. Fetch data from your API (current price, volume, 50-day history)
      const data = await fetchStockData(ticker); 
      // 2. Calculate 50 DMA and Average Volume
      const { currentPrice, currentVolume, ma50, avgVolume } = calculateMetrics(data); 

      setStockData({ currentPrice, currentVolume, ma50, avgVolume });
      setLoading(false);

      // 3. Check Alert Condition
      const priceTolerance = 0.005 * ma50; // e.g., 0.5% tolerance
      const isNearMA = Math.abs(currentPrice - ma50) <= priceTolerance;
      const isHighVolume = currentVolume >= avgVolume;

      if (isHighVolume && isNearMA) {
        setAlertTriggered(true);
        // Trigger a browser notification or a sound here
      } else {
        setAlertTriggered(false);
      }
    };

    fetchData(); 
    // Set up an interval for continuous polling/real-time updates
    const intervalId = setInterval(fetchData, 60000); 

    // Cleanup function to clear the interval
    return () => clearInterval(intervalId);
  }, [ticker]);

  if (loading) return <div>Loading stock data...</div>;

  return (
    <div>
      {/* Display Stock Details */}
      <h3>Stock: {ticker}</h3>
      <p>Current Price: ${stockData.currentPrice.toFixed(2)}</p>
      <p>50-Day Moving Average: ${stockData.ma50.toFixed(2)}</p>
      <p>Current Volume: {stockData.currentVolume.toLocaleString()}</p>
      <p>Average Volume: {stockData.avgVolume.toLocaleString()}</p>
      
      {/* Alert Component */}
      {alertTriggered ? (
        <div style={{ padding: '10px', background: 'red', color: 'white', fontWeight: 'bold' }}>
          🚨 ALERT! High Volume at 50 DMA!
        </div>
      ) : (
        <div style={{ padding: '10px', background: 'green', color: 'white' }}>
          Conditions not met.
        </div>
      )}
    </div>
  );
};