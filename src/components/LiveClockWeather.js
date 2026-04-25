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
  const [accuracy, setAccuracy] = useState(null);
  const [manualCity, setManualCity] = useState("");
  const [isManual, setIsManual] = useState(false);
  const [isManualSet, setIsManualSet] = useState(false);

  const API_KEY = "3caa4be66b5ff46bb71cdffcd6097ec7";

  useEffect(() => {
    const saved = localStorage.getItem("manualLocation");
    if (saved) {
      const parsed = JSON.parse(saved);
      setCoords(parsed.coords);
      setCity(parsed.city);
      setIsManual(true);
    }
  }, []);

  const fetchCityWeather = async (cityName) => {
    try {
      const res = await fetch(
        `https://api.openweathermap.org/data/2.5/weather?q=${cityName}&units=metric&appid=${API_KEY}`
      );

      const data = await res.json();

      if (data.cod !== 200) {
        alert("City not found");
        return;
      }

      const newCoords = {
        lat: data.coord.lat,
        lon: data.coord.lon,
      };

      setCoords(newCoords);
      setCity(data.name);
      setIsManual(true);

      // save
      localStorage.setItem(
        "manualLocation",
        JSON.stringify({
          city: data.name,
          coords: newCoords,
        })
      );
    } catch {
      alert("Failed to fetch city");
    }
  };

  useEffect(() => {
    if (isManual) return; // ✅ stop auto detect

    navigator.geolocation?.getCurrentPosition(
      (pos) => {
        if (pos.coords.accuracy > 1000) {
          fetchIPLocation();
          return;
        }

        setCoords({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
        });
      },
      () => fetchIPLocation(),
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  }, [isManual]);

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

  const fetchIPLocation = async () => {
    try {
      const res = await fetch("https://ipapi.co/json/");
      const data = await res.json();

      if (!data.latitude || !data.longitude) throw new Error("Invalid IP data");

      setCoords({
        lat: data.latitude,
        lon: data.longitude,
      });

      setCity(data.city || "Unknown");
    } catch (e) {
      console.log("IP fallback failed:", e);

      // last fallback
      setCoords({ lat: 22.5726, lon: 88.3639 });
      setCity("Kolkata");
    }
  };

  // 📍 GPS
  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      (pos) => {
        console.log("LAT:", pos.coords.latitude);
        console.log("LON:", pos.coords.longitude);
        console.log("ACCURACY:", pos.coords.accuracy);

        // ❗ STOP here if accuracy is bad
        if (pos.coords.accuracy > 1000) {
          console.log("Low accuracy, using fallback...");
          fetchIPLocation();
          return; // ✅ THIS LINE FIXES YOUR ISSUE
        }

        setAccuracy(pos.coords.accuracy);
        setCoords({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
        });
      },
      async (err) => {
        console.log("GPS Error:", err);

        // ✅ Better fallback → use IP instead of hardcoded Kolkata
        await fetchIPLocation();
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
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
      {isManualSet && (
        <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
        <input
          type="text"
          placeholder="Enter city"
          value={manualCity}
          onChange={(e) => setManualCity(e.target.value)}
          style={{
            padding: "3px 6px",
            borderRadius: "6px",
            border: "none",
            fontSize: "11px",
          }}
        />

        <button
          onClick={() => {fetchCityWeather(manualCity); setIsManualSet((prev) => !prev);}}
          style={{
            padding: "3px 6px",
            borderRadius: "6px",
            border: "none",
            cursor: "pointer",
          }}
        >
          Set
        </button>

        {isManual && (
          <button
            onClick={() => {
              localStorage.removeItem("manualLocation");
              setIsManual(false);
              setCity("Detecting...");
              setCoords(null);
              setIsManualSet((prev) => !prev);
            }}
            style={{
              padding: "3px 6px",
              borderRadius: "6px",
              border: "none",
              cursor: "pointer",
              background: "#ef4444",
              color: "#fff",
            }}
          >
            Reset
          </button>
        )}
      </div>
      )}
      
      <div style={{ fontSize: "10px", opacity: 0.6 }} onClick={() => setIsManualSet((prev) => !prev)}>
        🎯 {accuracy ? `${Math.round(accuracy)}m` : "N/A"}
      </div>
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