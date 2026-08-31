"use client";

import { FormEvent, PointerEvent, WheelEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RawWeatherResponse, Unit, WeatherData } from "@/types/weather";
import { dayLabel, hourLabel, normalizeWeather, speed, summary, temp } from "@/features/weather/utils/weather";
import { WeatherIcon } from "./WeatherIcon";

const DEFAULT_CITY = "Ahmedabad";

const savedUnit = (): Unit => {
  if (typeof window === "undefined") return "c";
  return (window.localStorage.getItem("atmos-unit") as Unit | null) ?? "c";
};

const savedTheme = () => {
  if (typeof window === "undefined") return "light";
  return window.localStorage.getItem("atmos-theme") ?? "light";
};

async function loadWeather(city: string, days = 10) {
  const response = await fetch(`/api/weather?city=${encodeURIComponent(city)}&days=${days}`);
  const json = await response.json();
  if (!response.ok) throw new Error(json.error ?? "Unable to load weather.");
  return normalizeWeather(json as RawWeatherResponse);
}

async function loadApproxLocation() {
  const response = await fetch("/api/location");
  if (!response.ok) return DEFAULT_CITY;
  const location = await response.json();
  return [location.city, location.region, location.country].filter(Boolean).join(", ") || DEFAULT_CITY;
}

type UiIcon = "search" | "location" | "sun" | "moon" | "humidity" | "wind" | "visibility" | "uv" | "sunrise" | "sunset" | "clock" | "close";

function Icon({ name, size = 18 }: { name: UiIcon; size?: number }) {
  const paths: Record<UiIcon, React.ReactNode> = {
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
    location: <><path d="M12 21s6-5 6-11a6 6 0 1 0-12 0c0 6 6 11 6 11Z" /><circle cx="12" cy="10" r="2" /></>,
    sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.66 6.34l1.41-1.41" /></>,
    moon: <path d="M20 15.2A8.5 8.5 0 0 1 8.8 4 8.5 8.5 0 1 0 20 15.2Z" />,
    humidity: <path d="M12 3s6 6.2 6 11a6 6 0 0 1-12 0c0-4.8 6-11 6-11Z" />,
    wind: <><path d="M3 8h10.5a2.5 2.5 0 1 0-2.3-3.5" /><path d="M3 12h16a2 2 0 1 1-1.6 3.2" /><path d="M3 16h8" /></>,
    visibility: <><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" /><circle cx="12" cy="12" r="2.5" /></>,
    uv: <><circle cx="12" cy="12" r="3.5" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2" /></>,
    sunrise: <><path d="M4 19h16" /><path d="M7 16a5 5 0 0 1 10 0H7Z" fill="currentColor" stroke="none" /><path d="M12 4v4M5.6 9.6l2 2M18.4 9.6l-2 2M3 15h2M19 15h2" /></>,
    sunset: <><path d="M4 19h16" /><path d="M7 16a5 5 0 0 1 10 0H7Z" fill="currentColor" stroke="none" /><path d="M12 11V4M9.5 6.5 12 4l2.5 2.5M5.5 11.5l2 1M18.5 11.5l-2 1" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    close: <path d="m6 6 12 12M18 6 6 18" />,
  };
  return <svg className="ui-icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

export function WeatherApp() {
  const hourlyTrackRef = useRef<HTMLDivElement>(null);
  const hourlyDragRef = useRef<{ x: number; scrollLeft: number } | null>(null);
  const [query, setQuery] = useState(DEFAULT_CITY);
  const [unit, setUnit] = useState<Unit>(savedUnit);
  const [theme, setTheme] = useState(savedTheme);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchWeather = useCallback(async (nextCity: string) => {
    setLoading(true);
    setError("");
    try {
      const data = await loadWeather(nextCity);
      setWeather(data);
      setQuery(nextCity);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load weather.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadApproxLocation()
        .then((initialCity) => fetchWeather(initialCity))
        .catch(() => fetchWeather(DEFAULT_CITY));
    }, 0);

    return () => window.clearTimeout(timer);
  }, [fetchWeather]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem("atmos-theme", theme);
  }, [theme]);

  useEffect(() => {
    window.localStorage.setItem("atmos-unit", unit);
  }, [unit]);

  const today = weather?.forecast[0];
  const hours = today?.hours.slice(0, 24) ?? [];
  const allTemps = weather?.forecast.flatMap((day) => [day.min, day.max]) ?? [];
  const weekMin = allTemps.length ? Math.min(...allTemps) : 0;
  const weekMax = allTemps.length ? Math.max(...allTemps) : 1;

  const localDate = useMemo(() => {
    if (!weather) return "";
    return new Intl.DateTimeFormat("en", {
      weekday: "long",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(weather.location.localtime.replace(" ", "T")));
  }, [weather]);

  const sunProgress = useMemo(() => {
    const clockMinutes = (value: string) => {
      const match = value.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
      if (!match) return 0;
      let hour = Number(match[1]);
      const minute = Number(match[2]);
      const period = match[3]?.toUpperCase();
      if (period === "PM" && hour !== 12) hour += 12;
      if (period === "AM" && hour === 12) hour = 0;
      return hour * 60 + minute;
    };

    const now = clockMinutes(weather?.location.localtime.split(" ")[1] ?? "00:00");
    const sunrise = clockMinutes(today?.sunrise ?? "06:00 AM");
    const sunset = clockMinutes(today?.sunset ?? "06:00 PM");
    return Math.min(1, Math.max(0, (now - sunrise) / Math.max(sunset - sunrise, 1)));
  }, [today?.sunrise, today?.sunset, weather?.location.localtime]);

  const sunX = 24 + 252 * sunProgress;
  const sunY = 82 - 248 * sunProgress * (1 - sunProgress);

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextCity = query.trim();
    if (nextCity) void fetchWeather(nextCity);
  };

  const locate = () => {
    if (!navigator.geolocation) {
      setError("Geolocation is not available in this browser.");
      return;
    }

    setError("");
    navigator.geolocation.getCurrentPosition(
      (position) => void fetchWeather(`${position.coords.latitude},${position.coords.longitude}`),
      (positionError) => {
        switch (positionError.code) {
          case positionError.PERMISSION_DENIED:
            setError("Location permission was denied. Enable location access in your browser settings to use your current location.");
            break;
          case positionError.POSITION_UNAVAILABLE:
            setError("Your current location could not be determined. Check your device's location services and try again.");
            break;
          case positionError.TIMEOUT:
            setError("Finding your current location took too long. Please try again.");
            break;
          default:
            setError("Unable to access your current location. Please try again.");
        }
      },
      {
        enableHighAccuracy: false,
        timeout: 10_000,
        maximumAge: 5 * 60_000,
      },
    );
  };

  const scrollHourly = (event: WheelEvent<HTMLDivElement>) => {
    const track = hourlyTrackRef.current;
    if (!track || track.scrollWidth <= track.clientWidth) return;

    const distance = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    const atStart = track.scrollLeft <= 0;
    const atEnd = track.scrollLeft + track.clientWidth >= track.scrollWidth - 1;
    if ((distance < 0 && atStart) || (distance > 0 && atEnd)) return;

    event.preventDefault();
    track.scrollBy({ left: distance, behavior: "smooth" });
  };

  const startHourlyDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "mouse" || event.button !== 0) return;
    hourlyDragRef.current = { x: event.clientX, scrollLeft: event.currentTarget.scrollLeft };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const moveHourlyDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (!hourlyDragRef.current) return;
    event.currentTarget.scrollLeft = hourlyDragRef.current.scrollLeft - (event.clientX - hourlyDragRef.current.x);
  };

  const stopHourlyDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (!hourlyDragRef.current) return;
    hourlyDragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  if (loading && !weather) {
    return (
      <main className="shell" aria-busy="true">
        <div className="skeleton hero-skeleton" />
        <div className="skeleton strip-skeleton" />
        <div className="skeleton rows-skeleton" />
      </main>
    );
  }

  if (!weather || !today) {
    return (
      <main className="center-state">
        <h1>Atmos</h1>
        <p>{error || "Weather data is unavailable."}</p>
        <button className="button primary" onClick={() => void fetchWeather(DEFAULT_CITY)}>Try again</button>
      </main>
    );
  }

  return (
    <>
      <header>
        <div className="header-inner">
          <a className="brand" href="#top" aria-label="Atmos home">
            <span className="brand-mark">A</span>
            <span className="brand-name">Atmos</span>
          </a>
          <form className="search" onSubmit={onSubmit}>
            <Icon name="search" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Search city" placeholder="Search a city" />
            <button type="submit" aria-label="Search weather">Search</button>
          </form>
          <div className="header-actions">
            <button className="icon-button location" onClick={locate} type="button" aria-label="Use current location">
              <Icon name="location" />
              <span>Use location</span>
            </button>
            <div className="segmented" aria-label="Temperature unit">
              <button className={unit === "c" ? "active" : ""} onClick={() => setUnit("c")} type="button">C</button>
              <button className={unit === "f" ? "active" : ""} onClick={() => setUnit("f")} type="button">F</button>
            </div>
            <button className="icon-button theme-toggle" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} type="button" aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`} title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}>
              <Icon name={theme === "dark" ? "sun" : "moon"} />
            </button>
          </div>
        </div>
      </header>

      {error && (
        <div className="notice" role="status">
          <div>
            <strong>Forecast not updated</strong>
            <span>{error}</span>
          </div>
          <button onClick={() => setError("")} type="button" aria-label="Dismiss message"><Icon name="close" /><span>Dismiss</span></button>
        </div>
      )}

      <main className="shell" id="top" aria-busy={loading}>
        <section className={`hero ${weather.current.condition.isDay ? "" : "night"}`}>
          <div className="hero-copy">
            <div className="hero-top">
              <WeatherIcon condition={weather.current.condition} size={78} />
              <div>
                <p className="eyebrow">{weather.location.city}, {weather.location.country}</p>
                <p className="local-date">{localDate}</p>
              </div>
            </div>
            <div className="current">
              <span className="temperature">{temp(weather.current.temperature, unit)}</span>
              <div>
                <WeatherIcon condition={weather.current.condition} />
                <h1>{weather.current.condition.text}</h1>
              </div>
            </div>
            <p className="summary">{summary(weather)}</p>
            <p className="hero-meta">
              High {temp(today.max, unit)} <i /> Low {temp(today.min, unit)} <i /> Wind {speed(weather.current.windSpeed, unit)}
            </p>
            <p className="updated"><Icon name="clock" size={14} /> Updated {weather.current.updatedAt}</p>
          </div>
          <div className="hero-orbit" aria-hidden="true"><span /><span /></div>
        </section>

        <section className="section hourly">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Hourly</span>
              <h2>Next 24 hours</h2>
            </div>
            <span className="timezone"><Icon name="clock" size={14} />{weather.location.timezone}</span>
          </div>
          <div className="hour-track" ref={hourlyTrackRef} onWheel={scrollHourly} onPointerDown={startHourlyDrag} onPointerMove={moveHourlyDrag} onPointerUp={stopHourlyDrag} onPointerCancel={stopHourlyDrag} tabIndex={0} aria-label="Scrollable 24-hour forecast">
            {hours.map((hour, index) => (
              <div className={`hour ${index === 0 ? "now" : ""}`} key={hour.time}>
                <span>{index === 0 ? "Now" : hourLabel(hour.time)}</span>
                <WeatherIcon condition={hour.condition} size={38} />
                <strong>{temp(hour.temperature, unit)}</strong>
                <small>{speed(hour.windSpeed, unit)}</small>
              </div>
            ))}
          </div>
        </section>

        <div className="content-grid">
          <section className="section daily">
            <div className="section-heading">
              <div>
                <span className="eyebrow">Daily</span>
                <h2>10-day forecast</h2>
              </div>
            </div>
            {weather.forecast.map((day, index) => {
              const left = ((day.min - weekMin) / Math.max(weekMax - weekMin, 1)) * 100;
              const width = ((day.max - day.min) / Math.max(weekMax - weekMin, 1)) * 100;
              return (
                <div className={`day-row ${index === 0 ? "today" : ""}`} key={day.date}>
                  <div className="day-label">
                    <strong>{dayLabel(day.date, index === 0)}</strong>
                    <span>{new Intl.DateTimeFormat("en", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${day.date}T12:00:00Z`))}</span>
                  </div>
                  <div className="condition">
                    <WeatherIcon condition={day.condition} size={34} />
                    <span>{day.condition.text}</span>
                  </div>
                  <span className="low">{temp(day.min, unit)}</span>
                  <span className="range"><i style={{ left: `${left}%`, width: `${width}%` }} /></span>
                  <strong>{temp(day.max, unit)}</strong>
                </div>
              );
            })}
          </section>

          <aside>
            <dl className="details detail-grid" aria-label="Current weather conditions">
                <div className="detail-card humidity-card">
                  <dt><span className="detail-icon"><Icon name="humidity" /></span>Humidity</dt>
                  <dd>{weather.current.humidity}<span className="detail-unit">%</span></dd>
                  <p>{weather.current.humidity < 30 ? "Dry air" : weather.current.humidity <= 60 ? "Comfortable" : "High humidity"}</p>
                  <span className="detail-meter" aria-hidden="true"><i style={{ width: `${Math.min(weather.current.humidity, 100)}%` }} /></span>
                </div>
                <div className="detail-card wind-card">
                  <dt><span className="detail-icon"><Icon name="wind" /></span>Wind</dt>
                  <dd>{speed(weather.current.windSpeed, unit)}</dd>
                  <p>{weather.current.windSpeed < 12 ? "Light breeze" : weather.current.windSpeed < 30 ? "Moderate breeze" : "Strong winds"}</p>
                  <span className="detail-card-mark" aria-hidden="true"><Icon name="wind" size={36} /></span>
                </div>
                <div className="detail-card visibility-card">
                  <dt><span className="detail-icon"><Icon name="visibility" /></span>Visibility</dt>
                  <dd>{weather.current.visibility}<span className="detail-unit"> km</span></dd>
                  <p>{weather.current.visibility >= 10 ? "Clear view" : weather.current.visibility >= 5 ? "Fair visibility" : "Limited visibility"}</p>
                  <span className="detail-card-mark" aria-hidden="true"><Icon name="visibility" size={36} /></span>
                </div>
                <div className="detail-card uv-card">
                  <dt><span className="detail-icon"><Icon name="uv" /></span>UV index</dt>
                  <dd>{weather.current.uv}</dd>
                  <p>{weather.current.uv < 3 ? "Low exposure" : weather.current.uv < 6 ? "Moderate exposure" : weather.current.uv < 8 ? "High exposure" : "Very high exposure"}</p>
                  <span className="detail-meter" aria-hidden="true"><i style={{ width: `${Math.min((weather.current.uv / 11) * 100, 100)}%` }} /></span>
                </div>
            </dl>

            <section className="section sun">
              <div className="section-heading">
                <div>
                  <span className="eyebrow">Sun</span>
                  <h2>Sunrise & sunset</h2>
                </div>
              </div>
              <div className="sun-times">
                <div><span className="sun-time-icon"><Icon name="sunrise" size={20} /></span><span className="sun-time-copy"><small>Sunrise</small><strong>{today.sunrise}</strong></span></div>
                <div><span className="sun-time-icon"><Icon name="sunset" size={20} /></span><span className="sun-time-copy"><small>Sunset</small><strong>{today.sunset}</strong></span></div>
              </div>
              <svg className="sun-chart" viewBox="0 0 300 112" role="img" aria-label={`Daylight path, ${Math.round(sunProgress * 100)} percent complete`}>
                <defs>
                  <filter id="sun-glow" x="-100%" y="-100%" width="300%" height="300%">
                    <feGaussianBlur stdDeviation="3.5" />
                  </filter>
                </defs>
                <path className="sun-chart-fill" d="M24 82 Q150 -42 276 82 L276 84 L24 84 Z" />
                <path className="sun-chart-path" d="M24 82 Q150 -42 276 82" />
                <path className="sun-chart-horizon" d="M16 84H284" />
                <g className="sun-marker" transform={`translate(${sunX} ${sunY})`}>
                  <circle className="sun-glow" r="13" />
                  <g className="sun-rays">
                    <path d="M0-15v-4M0 15v4M-15 0h-4M15 0h4M-10.6-10.6l-2.9-2.9M10.6 10.6l2.9 2.9M10.6-10.6l2.9-2.9M-10.6 10.6l-2.9 2.9" />
                  </g>
                  <circle className="sun-disc" r="9" />
                </g>
                <circle className="sun-endpoint" cx="24" cy="84" r="3" />
                <circle className="sun-endpoint" cx="276" cy="84" r="3" />
              </svg>
            </section>
          </aside>
        </div>

      </main>

      <footer>
        <span>Atmos weather dashboard</span>
        <span>Weather data from WeatherAPI.com</span>
      </footer>
    </>
  );
}
