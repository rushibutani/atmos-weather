"use client";

import { FormEvent, PointerEvent, WheelEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RawWeatherResponse, Unit, WeatherData } from "@/types/weather";
import { formatDate, formatDay, formatPrecipitation, formatRelativeUpdate, formatTemperature, formatTime, formatTimezone, formatUV, formatVisibility, formatWind, normalizeWeather, summary } from "@/features/weather/utils/weather";
import { WeatherIcon } from "./WeatherIcon";

const DEFAULT_CITY = "Ahmedabad";
const WEATHER_CACHE_KEY = "atmos-weather-cache-v1";
const WEATHER_CACHE_TTL = 10 * 60_000;
const MAX_CACHED_LOCATIONS = 5;

type WeatherCacheEntry = { data: WeatherData; savedAt: number };
type WeatherCache = Record<string, WeatherCacheEntry>;

const memoryCache = new Map<string, WeatherCacheEntry>();
const pendingWeather = new Map<string, Promise<WeatherData>>();

const weatherKey = (city: string, days: number) => `${city.trim().replace(/\s+/g, " ").toLocaleLowerCase()}|${days}`;

function readWeatherCache(key: string) {
  const memoryEntry = memoryCache.get(key);
  if (memoryEntry && Date.now() - memoryEntry.savedAt < WEATHER_CACHE_TTL) return memoryEntry.data;
  if (typeof window === "undefined") return null;

  try {
    const cache = JSON.parse(window.localStorage.getItem(WEATHER_CACHE_KEY) ?? "{}") as WeatherCache;
    const entry = cache[key];
    if (entry && Date.now() - entry.savedAt < WEATHER_CACHE_TTL) {
      memoryCache.set(key, entry);
      return entry.data;
    }
  } catch { /* Ignore unavailable or invalid browser storage. */ }
  return null;
}

function writeWeatherCache(key: string, data: WeatherData) {
  const entry = { data, savedAt: Date.now() };
  memoryCache.set(key, entry);
  if (typeof window === "undefined") return;

  try {
    const stored = JSON.parse(window.localStorage.getItem(WEATHER_CACHE_KEY) ?? "{}") as WeatherCache;
    const cache = Object.fromEntries(
      Object.entries({ ...stored, [key]: entry })
        .filter(([, value]) => Date.now() - value.savedAt < WEATHER_CACHE_TTL)
        .sort(([, a], [, b]) => b.savedAt - a.savedAt)
        .slice(0, MAX_CACHED_LOCATIONS),
    );
    window.localStorage.setItem(WEATHER_CACHE_KEY, JSON.stringify(cache));
  } catch { /* Weather still works when storage is blocked or full. */ }
}

const savedUnit = (): Unit => {
  if (typeof window === "undefined") return "c";
  return (window.localStorage.getItem("atmos-unit") as Unit | null) ?? "c";
};

const savedTheme = () => {
  if (typeof window === "undefined") return "light";
  return window.localStorage.getItem("atmos-theme") ?? "light";
};

async function loadWeather(city: string, days = 10) {
  const key = weatherKey(city, days);
  const cached = readWeatherCache(key);
  if (cached) return cached;

  const pending = pendingWeather.get(key);
  if (pending) return pending;

  const request = fetch(`/api/weather?city=${encodeURIComponent(city.trim())}&days=${days}`)
    .then(async (response) => {
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? "Unable to load weather.");
      const data = normalizeWeather(json as RawWeatherResponse);
      writeWeatherCache(key, data);
      return data;
    })
    .finally(() => pendingWeather.delete(key));

  pendingWeather.set(key, request);
  return request;
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
  const requestSequenceRef = useRef(0);
  const [query, setQuery] = useState(DEFAULT_CITY);
  const [unit, setUnit] = useState<Unit>(savedUnit);
  const [theme, setTheme] = useState(savedTheme);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [locating, setLocating] = useState(false);
  const [offline, setOffline] = useState(false);
  const [hourlyEdges, setHourlyEdges] = useState({ left: false, right: false });

  const fetchWeather = useCallback(async (nextCity: string) => {
    const requestSequence = ++requestSequenceRef.current;
    setLoading(true);
    setError("");
    try {
      const data = await loadWeather(nextCity);
      if (requestSequence !== requestSequenceRef.current) return;
      setWeather(data);
      setQuery(nextCity);
      window.localStorage.setItem("atmos-last-weather", JSON.stringify(data));
      setStatus(`Weather updated for ${data.location.city}.`);
    } catch (err) {
      if (requestSequence !== requestSequenceRef.current) return;
      setError(err instanceof Error ? err.message : "Unable to load weather.");
    } finally {
      if (requestSequence === requestSequenceRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const cached = window.localStorage.getItem("atmos-last-weather");
      if (!navigator.onLine && cached) {
        try { setWeather(JSON.parse(cached) as WeatherData); setLoading(false); setOffline(true); return; } catch { /* Ignore invalid cache. */ }
      }
      void fetchWeather(DEFAULT_CITY);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [fetchWeather]);

  useEffect(() => {
    const sync = () => setOffline(!navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => { window.removeEventListener("online", sync); window.removeEventListener("offline", sync); };
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem("atmos-theme", theme);
  }, [theme]);

  useEffect(() => {
    window.localStorage.setItem("atmos-unit", unit);
  }, [unit]);

  const updateHourlyEdges = useCallback(() => {
    const track = hourlyTrackRef.current;
    if (!track) return;
    const maxScroll = track.scrollWidth - track.clientWidth;
    const left = track.scrollLeft > 1;
    const right = maxScroll > 1 && track.scrollLeft < maxScroll - 1;
    setHourlyEdges((current) => current.left === left && current.right === right ? current : { left, right });
  }, []);

  useEffect(() => {
    const track = hourlyTrackRef.current;
    if (!track || !weather) return;
    updateHourlyEdges();
    const resizeObserver = new ResizeObserver(updateHourlyEdges);
    resizeObserver.observe(track);
    return () => resizeObserver.disconnect();
  }, [weather, updateHourlyEdges]);

  const today = weather?.forecast[0];
  const hours = useMemo(() => {
    if (!weather) return [];
    const current = weather.location.localtime.slice(0, 13);
    return weather.forecast.flatMap((day) => day.hours).filter((hour) => hour.time.slice(0, 13) >= current).slice(0, 24);
  }, [weather]);
  const tenDayForecast = weather?.forecast.slice(0, 10) ?? [];
  const forecastMin = tenDayForecast.length ? Math.min(...tenDayForecast.map((day) => day.min)) : 0;
  const forecastMax = tenDayForecast.length ? Math.max(...tenDayForecast.map((day) => day.max)) : 1;
  const forecastRange = Math.max(forecastMax - forecastMin, 1);

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
      setError("Location isn't supported by this browser. Search for a city instead.");
      return;
    }

    setError("");
    setLocating(true);
    setStatus("Waiting for location permission.");
    navigator.geolocation.getCurrentPosition(
      (position) => { setLocating(false); void fetchWeather(`${position.coords.latitude},${position.coords.longitude}`); },
      (positionError) => {
        setLocating(false);
        switch (positionError.code) {
          case positionError.PERMISSION_DENIED:
            setError("Location access is turned off. Search for a city instead.");
            break;
          case positionError.POSITION_UNAVAILABLE:
            setError("Your location isn't available right now. Search for a city or try again.");
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
        <span className="sr-only" role="status">Loading weather</span>
        <div className="hero-skeleton skeleton"><i/><i/><i/><i/></div>
        <div className="strip-skeleton skeleton"><i/><i/><i/><i/><i/><i/></div>
        <div className="skeleton-grid"><div className="rows-skeleton skeleton"/><div className="cards-skeleton">{[0,1,2,3].map((item) => <i className="skeleton" key={item}/>)}</div></div>
      </main>
    );
  }

  if (!weather || !today) {
    return (
      <main className="center-state">
        <h1>Atmos</h1>
        <p>{error || (offline ? "You're offline and no saved weather is available." : "Forecast data isn't available for this location right now.")}</p>
        {!offline && <button className="button primary" onClick={() => void fetchWeather(DEFAULT_CITY)}>Try again</button>}
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
            <input value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Search weather by city" placeholder="Search a city" autoComplete="off" />
            <button type="submit" disabled={loading || !query.trim()} aria-label="Search weather" title="Search weather"><Icon name="search" /><span>{loading ? "Loading…" : "Search"}</span></button>
          </form>
          <div className="header-actions">
            <button className="icon-button location" onClick={locate} disabled={locating} type="button" aria-label="Use current location" title="Use current location">
              <Icon name="location" />
              <span>{locating ? "Locating…" : "Use location"}</span>
            </button>
            <div className="segmented" role="group" aria-label="Temperature unit">
              <button className={unit === "c" ? "active" : ""} onClick={() => setUnit("c")} type="button" aria-label="Use Celsius" aria-pressed={unit === "c"}>°C</button>
              <span aria-hidden="true">|</span>
              <button className={unit === "f" ? "active" : ""} onClick={() => setUnit("f")} type="button" aria-label="Use Fahrenheit" aria-pressed={unit === "f"}>°F</button>
            </div>
            <button className="icon-button theme-toggle" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} type="button" aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`} title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}>
              <Icon name={theme === "dark" ? "sun" : "moon"} />
            </button>
          </div>
        </div>
      </header>

      <div className="sr-only" aria-live="polite">{status}</div>
      {offline && <div className="offline-notice" role="status">Offline · showing last updated weather</div>}

      {error && (
        <div className="notice" role="status">
          <div>
            <strong>Forecast not updated</strong>
            <span>{error}</span>
          </div>
          <button onClick={() => setError("")} type="button" aria-label="Dismiss message"><Icon name="close" /><span>Dismiss</span></button>
        </div>
      )}

      <main className={`shell weather-content ${loading ? "is-refreshing" : ""}`} id="top" aria-busy={loading}>
        <section className={`hero ${weather.current.condition.isDay ? "" : "night"}`}>
          <div className="hero-copy">
            <div className="hero-top">
              <WeatherIcon condition={weather.current.condition} size={78} />
              <div>
                <p className="eyebrow">{weather.location.city}{weather.location.region ? `, ${weather.location.region}` : `, ${weather.location.country}`}</p>
                <p className="local-date">{localDate}</p>
              </div>
            </div>
            <div className="current">
              <span className="temperature">{formatTemperature(weather.current.temperature, unit)}</span>
              <div>
                <WeatherIcon condition={weather.current.condition} />
                <h1>{weather.current.condition.text}</h1>
              </div>
            </div>
            <p className="summary">{summary(weather, unit)}</p>
            <p className="hero-meta">
              Feels like {formatTemperature(weather.current.feelsLike, unit)} <i /> H {formatTemperature(today.max, unit)} <i /> L {formatTemperature(today.min, unit)} <i /> Wind {formatWind(weather.current.windSpeed, unit)}
            </p>
            <p className="updated" title={`Exact update: ${weather.current.updatedAt}`}><Icon name="clock" size={14} /> Updated {formatRelativeUpdate(weather.current.updatedAt, weather.location.localtime)}</p>
          </div>
          <div className="hero-orbit" aria-hidden="true"><span /><span /></div>
        </section>

        <section className="section hourly">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Hourly</span>
              <h2>Next 24 hours</h2>
            </div>
            <span className="timezone" title={weather.location.timezone}><Icon name="clock" size={14} />Local time · {formatTimezone(weather.location.timezone)}</span>
          </div>
          <div className={`hour-scroll ${hourlyEdges.left ? "can-scroll-left" : ""} ${hourlyEdges.right ? "can-scroll-right" : ""}`}>
            <div className="hour-track" ref={hourlyTrackRef} onScroll={updateHourlyEdges} onWheel={scrollHourly} onPointerDown={startHourlyDrag} onPointerMove={moveHourlyDrag} onPointerUp={stopHourlyDrag} onPointerCancel={stopHourlyDrag} tabIndex={0} aria-label="Scrollable 24-hour forecast">
              {hours.map((hour, index) => (
                <div className={`hour ${index === 0 ? "now" : ""}`} key={hour.time}>
                  <span>{index === 0 ? "Now" : formatTime(hour.time)}</span>
                  <WeatherIcon condition={hour.condition} size={38} />
                  <strong>{formatTemperature(hour.temperature, unit)}</strong>
                  <small className={hour.precipitationChance === 0 ? "quiet" : ""}>{formatPrecipitation(hour.precipitationChance)} <span className="rain-label">rain</span></small>
                </div>
              ))}
            </div>
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
            {tenDayForecast.map((day, index) => {
              const left = ((day.min - forecastMin) / forecastRange) * 100;
              const width = ((day.max - day.min) / forecastRange) * 100;
              return (
                <div className={`day-row ${index === 0 ? "today" : ""}`} key={day.date}>
                  <div className="day-label">
                    <strong>{formatDay(day.date, index === 0)}</strong>
                    <span>{formatDate(day.date)}</span>
                  </div>
                  <div className="condition">
                    <WeatherIcon condition={day.condition} size={34} />
                    <span>{day.condition.text}</span>
                  </div>
                  <span className="low">{formatTemperature(day.min, unit)}</span>
                  <span className="range"><i style={{ left: `${left}%`, width: `${width}%` }} /></span>
                  <strong>{formatTemperature(day.max, unit)}</strong>
                </div>
              );
            })}
          </section>

          <aside>
            <dl className="details detail-grid" aria-label="Current weather conditions">
                <div className="detail-card feels-card">
                  <dt><span className="detail-icon"><Icon name="sun" /></span>Feels like</dt>
                  <dd>{formatTemperature(weather.current.feelsLike, unit)}</dd>
                  <p>{weather.current.feelsLike > weather.current.temperature + 2 ? "Feels warmer" : weather.current.feelsLike < weather.current.temperature - 2 ? "Feels cooler" : "Close to actual"}</p>
                  <span className="detail-card-mark" aria-hidden="true"><Icon name="sun" size={36} /></span>
                </div>
                <div className="detail-card humidity-card">
                  <dt><span className="detail-icon"><Icon name="humidity" /></span>Humidity</dt>
                  <dd>{weather.current.humidity}<span className="detail-unit">%</span></dd>
                  <p>{weather.current.humidity < 30 ? "Dry air" : weather.current.humidity <= 60 ? "Comfortable" : "High humidity"}</p>
                  <span className="detail-meter" aria-hidden="true"><i style={{ width: `${Math.min(weather.current.humidity, 100)}%` }} /></span>
                </div>
                <div className="detail-card wind-card">
                  <dt><span className="detail-icon"><Icon name="wind" /></span>Wind</dt>
                  <dd>{formatWind(weather.current.windSpeed, unit).split(" ")[0]}<span className="detail-unit"> {formatWind(weather.current.windSpeed, unit).split(" ").slice(1).join(" ")}</span></dd>
                  <p>{weather.current.windSpeed < 12 ? "Light breeze" : weather.current.windSpeed < 30 ? "Moderate breeze" : "Strong winds"}</p>
                  <span className="detail-card-mark" aria-hidden="true"><Icon name="wind" size={36} /></span>
                </div>
                <div className="detail-card uv-card">
                  <dt><span className="detail-icon"><Icon name="uv" /></span>UV index</dt>
                  <dd>{formatUV(weather.current.uv)}</dd>
                  <p>{weather.current.uv < 3 ? "Low exposure" : weather.current.uv < 6 ? "Moderate exposure" : weather.current.uv < 8 ? "High exposure" : "Very high exposure"}</p>
                  <span className="detail-meter" aria-hidden="true"><i style={{ width: `${Math.min((weather.current.uv / 11) * 100, 100)}%` }} /></span>
                </div>
            </dl>
            {weather.current.visibility < 5 && <p className="visibility-note"><Icon name="visibility" /> Visibility is limited to {formatVisibility(weather.current.visibility, unit)}.</p>}

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
        <span>© {new Date().getFullYear()} Atmos</span>
        <span>Weather data from <a href="https://www.weatherapi.com/" rel="noopener noreferrer">WeatherAPI.com</a></span>
      </footer>
    </>
  );
}
