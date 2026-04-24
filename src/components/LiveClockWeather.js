import React, { useEffect, useState } from "react";

const LiveClockWeather = () => {
  const [time, setTime] = useState("");
  const [date, setDate] = useState("");
  const [temp, setTemp] = useState("--");
  const [feels, setFeels] = useState("");
  const [wind, setWind] = useState("");
  const [city, setCity] = useState("Detecting...");
  const [icon, setIcon] = useState("");
  const [coords, setCoords] = useState(null);

  const API_KEY = "3caa4be66b5ff46bb71cdffcd6097ec7";

  // ⏰ Clock + Date (IST)
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();

      setTime(
        now.toLocaleTimeString("en-IN", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      );

      setDate(
        now.toLocaleDateString("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric",
          weekday: "short",
        })
      );
    };

    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  // 📍 GPS
  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      (pos) => {
        setCoords({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
        });
      },
      () => {
        // fallback Kolkata
        setCoords({ lat: 22.5726, lon: 88.3639 });
        setCity("Kolkata");
      }
    );
  }, []);

  // 🌤️ Weather
  useEffect(() => {
    if (!coords) return;

    const fetchWeather = async () => {
      try {
        const res = await fetch(
          `https://api.openweathermap.org/data/2.5/weather?lat=${coords.lat}&lon=${coords.lon}&units=metric&appid=${API_KEY}`
        );

        const data = await res.json();

        if (data.cod !== 200) {
          setTemp("Err");
          return;
        }

        setCity(data.name);
        setTemp(`${Math.round(data.main.temp)}°C`);
        setFeels(`Feels ${Math.round(data.main.feels_like)}°C`);
        setWind(`${data.wind.speed} m/s`);
        setIcon(`https://openweathermap.org/img/wn/${data.weather[0].icon}@2x.png`);
      } catch {
        setTemp("Err");
      }
    };

    fetchWeather();

    // refresh every 10 min
    const interval = setInterval(fetchWeather, 600000);
    return () => clearInterval(interval);
  }, [coords]);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "12px",
        background: "linear-gradient(135deg, #0f172a, #1e293b)",
        padding: "6px 12px",
        borderRadius: "10px",
        color: "#fff",
        fontSize: "12px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
      }}
    >
      {/* Weather Icon */}
      {icon && (
        <img src={icon} alt="weather" style={{ width: "32px", height: "32px" }} />
      )}

      {/* Location + Temp */}
      <div>
        <div style={{ fontWeight: "600" }}>📍 {city}</div>
        <div style={{ fontSize: "11px", opacity: 0.8 }}>
          🌡️ {temp} | {feels}
        </div>
      </div>

      {/* Wind */}
      <div style={{ fontSize: "11px", opacity: 0.8 }}>
        🌬️ {wind}
      </div>

      {/* Time + Date */}
      <div style={{ textAlign: "right" }}>
        <div style={{ fontWeight: "600" }}>⏰ {time}</div>
        <div style={{ fontSize: "10px", opacity: 0.7 }}>{date}</div>
      </div>
    </div>
  );
};

export default LiveClockWeather;