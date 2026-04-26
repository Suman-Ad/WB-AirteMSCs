import React, { useEffect, useState } from "react";

const LiveClockWeather = ({ isMobile }) => {
  const [time, setTime] = useState("");
  const [date, setDate] = useState("");
  const [temp, setTemp] = useState("--");
  const [feels, setFeels] = useState("");
  const [wind, setWind] = useState("");
  const [city, setCity] = useState("Detecting...");
  const [icon, setIcon] = useState("");
  const [wStatus, setWStatus] = useState("Loading...");
  const [wDisc, setWDisc] = useState("");
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
        setWStatus(data.weather[0].main);
        setWDisc(data.weather[0].description);
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

  const getWeatherTheme = () => {
    const status = wStatus?.toLowerCase();

    if (status?.includes("clear")) {
      return {
        gradient: "linear-gradient(120deg, #facc15, #f97316, #fde047, #facc15)",
        glow: "rgba(251,191,36,0.6)",
      };
    }

    if (status?.includes("cloud")) {
      return {
        gradient: "linear-gradient(120deg, #94a3b8, #64748b, #cbd5f5, #94a3b8)",
        glow: "rgba(148, 163, 184, 0.5)",
      };
    }

    if (status?.includes("rain") || status?.includes("drizzle")) {
      return {
        gradient: "linear-gradient(120deg, #0ea5e9, #1e3a8a, #38bdf8, #0ea5e9)",
        glow: "rgba(14,165,233,0.5)",
      };
    }

    if (status?.includes("thunder")) {
      return {
        gradient: "linear-gradient(120deg, #4c1d95, #111827, #1e1b4b, #4c1d95)",
        glow: "rgba(99,102,241,0.6)",
      };
    }

    if (status?.includes("mist") || status?.includes("fog") || status?.includes("haze")) {
      return {
        gradient: "linear-gradient(120deg, #6b7280, #374151, #9ca3af, #6b7280)",
        glow: "rgba(107,114,128,0.5)",
      };
    }

    return {
      gradient: "linear-gradient(120deg, #1e293b, #0f172a, #334155, #1e293b)",
      glow: "rgba(100,116,139,0.5)",
    };
  };

  const theme = getWeatherTheme();

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "12px",

        // ✅ Correct background
        background: isMobile ? "transparent" : theme.gradient,

        // ✅ REQUIRED for animation
        backgroundSize: "300% 300%",
        backgroundPosition: "0% 50%",

        // ✅ Single clean animation
        animation: isMobile ? "none" : "gradientMove 12s linear infinite",

        padding: "8px 14px",
        borderRadius: "16px",

        color: "#fff",
        fontSize: "12px",

        // 🔥 Glass effect
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        border: "1px solid rgba(255,255,255,0.15)",

        // 🔥 Glow
        boxShadow: `
      0 4px 20px rgba(0,0,0,0.4),
      0 0 20px ${theme.glow}
    `,

        transition: "all 0.6s ease",
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
            onClick={() => { fetchCityWeather(manualCity); setIsManualSet((prev) => !prev); }}
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

      <div style={{ fontSize: "10px", opacity: 0.6, cursor: "pointer" }} onClick={() => setIsManualSet((prev) => !prev)}>
        🎯 {accuracy ? `${Math.round(accuracy)}m` : "N/A"}
      </div>
      {/* Weather Icon */}
      {icon && (
        <img src={icon} alt="weather" style={{ width: "32px", height: "32px" }} />
      )}

      {/* Location + Temp */}
      <div>
        <div style={{
          fontWeight: "600",
          letterSpacing: "0.5px",
          textShadow: "0 1px 2px rgba(0,0,0,0.5)"
        }}>📍 {city}</div>
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
        <div style={{ fontWeight: !isMobile ? "900" : "600", fontSize: isMobile ? "12px" : "20px", textShadow: "0 2px 6px rgba(0,0,0,0.6)" }}>⏰ {time}</div>
        <div style={{ fontSize: "10px", opacity: 0.7 }}>{date}</div>
      </div>
    </div>
  );
};

export default LiveClockWeather;