"use client";

import { FormEvent, KeyboardEvent, MouseEvent, PointerEvent, WheelEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import type { RawWeatherResponse, Unit, WeatherData } from "@/types/weather";
import { formatDate, formatDay, formatPrecipitation, formatRelativeUpdate, formatTemperature, formatTime, formatTimezone, formatUV, formatVisibility, formatWind, normalizeWeather, summary } from "@/features/weather/utils/weather";
import { WeatherIcon } from "./WeatherIcon";

const DEFAULT_CITY = "Ahmedabad";
const WEATHER_CACHE_KEY = "atmos-weather-cache-v1";
const LAST_CITY_KEY = "atmos-last-city";
const RECENT_CITIES_KEY = "atmos-recent-cities-v1";
const WEATHER_CACHE_TTL = 10 * 60_000;
const MAX_CACHED_LOCATIONS = 5;
const MAX_RECENT_CITIES = 5;

type WeatherCacheEntry = { data: WeatherData; savedAt: number };
type WeatherCache = Record<string, WeatherCacheEntry>;

const memoryCache = new Map<string, WeatherCacheEntry>();
const pendingWeather = new Map<string, Promise<WeatherData>>();

const weatherKey = (city: string, days: number) => `${city.trim().replace(/\s+/g, " ").toLocaleLowerCase()}|${days}`;
const normalizeCity = (city: string) => city.trim().replace(/\s+/g, " ");

function readRecentCities() {
  try {
    const stored = JSON.parse(window.localStorage.getItem(RECENT_CITIES_KEY) ?? "[]") as unknown;
    return Array.isArray(stored) ? stored.filter((city): city is string => typeof city === "string" && Boolean(normalizeCity(city))).slice(0, MAX_RECENT_CITIES) : [];
  } catch {
    return [];
  }
}

function rememberCity(city: string) {
  const normalized = normalizeCity(city);
  if (!normalized) return [];
  const recent = [normalized, ...readRecentCities().filter((item) => item.toLocaleLowerCase() !== normalized.toLocaleLowerCase())].slice(0, MAX_RECENT_CITIES);
  try {
    window.localStorage.setItem(LAST_CITY_KEY, normalized);
    window.localStorage.setItem(RECENT_CITIES_KEY, JSON.stringify(recent));
  } catch { /* Preferences are optional when browser storage is unavailable. */ }
  return recent;
}

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
  const searchInputRef = useRef<HTMLInputElement>(null);
  const hourlyTrackRef = useRef<HTMLDivElement>(null);
  const hourlyDragRef = useRef<{ x: number; scrollLeft: number } | null>(null);
  const requestSequenceRef = useRef(0);
  const themeTransitionRef = useRef(false);
  const [query, setQuery] = useState(DEFAULT_CITY);
  const [unit, setUnit] = useState<Unit>("c");
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [preferencesReady, setPreferencesReady] = useState(false);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [locating, setLocating] = useState(false);
  const [offline, setOffline] = useState(false);
  const [hourlyEdges, setHourlyEdges] = useState({ left: false, right: false });
  const [recentCities, setRecentCities] = useState<string[]>([]);
  // The viewer's clock, so "Updated … ago" keeps counting. Weather loads only in the
  // browser, so this never has to match a server render.
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const tick = () => setNow(Date.now());
    const timer = window.setInterval(tick, 30_000);
    // Background tabs throttle timers; catch up as soon as the tab is visible again.
    const onVisible = () => { if (document.visibilityState === "visible") tick(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", onVisible); };
  }, []);

  const fetchWeather = useCallback(async (nextCity: string, showResolvedCity = false, rememberSearch = true) => {
    const requestSequence = ++requestSequenceRef.current;
    setLoading(true);
    setError("");
    try {
      const data = await loadWeather(nextCity);
      if (requestSequence !== requestSequenceRef.current) return;
      setWeather(data);
      setQuery(showResolvedCity ? data.location.city : nextCity);
      try { window.localStorage.setItem("atmos-last-weather", JSON.stringify(data)); } catch { /* Offline fallback is optional. */ }
      if (rememberSearch) setRecentCities(rememberCity(nextCity));
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
      let cached: string | null = null;
      let initialCity = DEFAULT_CITY;
      try {
        cached = window.localStorage.getItem("atmos-last-weather");
        initialCity = normalizeCity(window.localStorage.getItem(LAST_CITY_KEY) ?? "") || DEFAULT_CITY;
        setRecentCities(readRecentCities());
      } catch { /* Use defaults when browser storage is unavailable. */ }
      setQuery(initialCity);
      if (!navigator.onLine && cached) {
        try { setWeather(JSON.parse(cached) as WeatherData); setLoading(false); setOffline(true); return; } catch { /* Ignore invalid cache. */ }
      }
      void fetchWeather(initialCity, false, false);
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
    const timer = window.setTimeout(() => {
      try {
        const storedUnit = window.localStorage.getItem("atmos-unit");
        if (storedUnit === "c" || storedUnit === "f") setUnit(storedUnit);

        const activeTheme = document.documentElement.dataset.theme;
        if (activeTheme === "light" || activeTheme === "dark") setTheme(activeTheme);
      } catch {
        // Keep deterministic defaults when browser storage is unavailable.
      } finally {
        setPreferencesReady(true);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!preferencesReady) return;
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem("atmos-theme", theme);
  }, [preferencesReady, theme]);

  const toggleTheme = (event: MouseEvent<HTMLButtonElement>) => {
    if (themeTransitionRef.current) return;
    const nextTheme = theme === "dark" ? "light" : "dark";
    const root = document.documentElement;
    const rect = event.currentTarget.getBoundingClientRect();
    const originX = rect.left + rect.width / 2;
    const originY = rect.top + rect.height / 2;
    const radius = Math.hypot(
      Math.max(originX, window.innerWidth - originX),
      Math.max(originY, window.innerHeight - originY),
    );
    root.style.setProperty("--theme-x", `${originX}px`);
    root.style.setProperty("--theme-y", `${originY}px`);
    root.style.setProperty("--theme-radius", `${Math.ceil(radius)}px`);

    const applyTheme = () => {
      flushSync(() => setTheme(nextTheme));
      root.dataset.theme = nextTheme;
    };
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const transitionDocument = document as Document & { startViewTransition?: (update: () => void) => { finished: Promise<void> } };

    if (reducedMotion || !transitionDocument.startViewTransition) {
      applyTheme();
      return;
    }
    themeTransitionRef.current = true;
    const transition = transitionDocument.startViewTransition(applyTheme);
    void transition.finished.finally(() => { themeTransitionRef.current = false; });
  };

  useEffect(() => {
    if (!preferencesReady) return;
    window.localStorage.setItem("atmos-unit", unit);
  }, [preferencesReady, unit]);

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
  const dailyForecast = weather?.forecast.slice(0, 10) ?? [];
  const forecastMin = dailyForecast.length ? Math.min(...dailyForecast.map((day) => day.min)) : 0;
  const forecastMax = dailyForecast.length ? Math.max(...dailyForecast.map((day) => day.max)) : 1;
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

  const clearSearch = () => {
    setQuery("");
    setStatus("Search cleared.");
    searchInputRef.current?.focus();
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
      (position) => { setLocating(false); void fetchWeather(`${position.coords.latitude},${position.coords.longitude}`, true, false); },
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

  const handleHourlyKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const track = event.currentTarget;
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight" && event.key !== "Home" && event.key !== "End") return;
    if (track.scrollWidth <= track.clientWidth) return;

    event.preventDefault();
    if (event.key === "Home" || event.key === "End") {
      track.scrollTo({ left: event.key === "Home" ? 0 : track.scrollWidth, behavior: "smooth" });
      return;
    }
    const hour = track.querySelector<HTMLElement>(".hour");
    const step = hour?.offsetWidth || Math.max(Math.round(track.clientWidth * 0.75), 1);
    track.scrollBy({ left: event.key === "ArrowLeft" ? -step : step, behavior: "smooth" });
  };

  const appHeader = (
    <header>
      <div className="header-inner">
        <a className="brand" href="#top">
          <span className="brand-mark" aria-hidden="true">A</span>
          <span className="brand-name">Atmos</span>
        </a>
        <form className="search" onSubmit={onSubmit} role="search">
          <input ref={searchInputRef} value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Search weather by city" placeholder="Search a city" autoComplete="address-level2" list="recent-cities" />
          <datalist id="recent-cities">
            {recentCities.map((city) => <option value={city} key={city} />)}
          </datalist>
          {query && <button className="search-clear" type="button" onClick={clearSearch} aria-label="Clear search" title="Clear search"><Icon name="close" size={16} /></button>}
          <button className={`search-submit ${loading ? "is-loading" : ""}`} type="submit" disabled={!query.trim()} aria-label="Search weather" title="Search weather"><Icon name="search" /><span>{loading ? "Loading…" : "Search"}</span></button>
        </form>
        <div className="header-actions">
          <button className={`icon-button location ${locating ? "is-locating" : ""}`} onClick={locate} disabled={locating} type="button" aria-label="Use current location" title="Use current location">
            <Icon name="location" />
            <span>{locating ? "Locating…" : "Use location"}</span>
          </button>
          <div className="segmented" role="group" aria-label="Temperature unit">
            <button className={unit === "c" ? "active" : ""} onClick={() => setUnit("c")} type="button" aria-pressed={unit === "c"} title="Celsius">°C</button>
            <span aria-hidden="true">|</span>
            <button className={unit === "f" ? "active" : ""} onClick={() => setUnit("f")} type="button" aria-pressed={unit === "f"} title="Fahrenheit">°F</button>
          </div>
          <button className="icon-button theme-toggle" onClick={toggleTheme} type="button" aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`} aria-pressed={theme === "dark"} title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}>
            <span className="theme-icon" key={theme}><Icon name={theme === "dark" ? "sun" : "moon"} /></span>
          </button>
        </div>
      </div>
    </header>
  );

  if (loading && !weather) {
    return (
      <>
        {appHeader}
        <main className="shell" aria-busy="true" id="top">
          <span className="sr-only" role="status">Loading weather</span>
          <div className="hero-skeleton skeleton"><i/><i/><i/><i/></div>
          <div className="strip-skeleton skeleton"><i/><i/><i/><i/><i/><i/></div>
          <div className="skeleton-grid"><div className="rows-skeleton skeleton"/><div className="cards-skeleton">{[0,1,2,3].map((item) => <i className="skeleton" key={item}/>)}</div></div>
        </main>
      </>
    );
  }

  if (!weather || !today) {
    return (
      <>
        {appHeader}
        <main className="center-state" id="top">
          <h1>Weather unavailable</h1>
          <p>{error || (offline ? "You're offline and no saved weather is available." : "Forecast data isn't available for this location right now.")}</p>
          {!offline && <button className="button primary" onClick={() => void fetchWeather(query.trim() || DEFAULT_CITY)}>Try again</button>}
        </main>
      </>
    );
  }

  return (
    <>
      {appHeader}

      <div className="sr-only" aria-live="polite">{status}</div>
      {error && (
        <div className="notice" role="alert">
          <div>
            <strong>Forecast not updated</strong>
            <span>{error}</span>
          </div>
          <button onClick={() => setError("")} type="button" aria-label="Dismiss message"><Icon name="close" /><span>Dismiss</span></button>
        </div>
      )}

      <main className={`shell weather-content ${loading ? "is-refreshing" : ""}`} key={`${weather.location.city}-${weather.current.updatedAt}`} id="top" aria-busy={loading}>
        <section className={`hero ${weather.current.condition.isDay ? "" : "night"}`}>
          <div className="hero-ambient" aria-hidden="true"><span /><span /></div>
          <div className="hero-copy">
            <div className="hero-top">
              <div>
                <p className="eyebrow"><Icon name="location" size={13} />{weather.location.city}{weather.location.region ? `, ${weather.location.region}` : `, ${weather.location.country}`}</p>
                <p className="local-date">{localDate}</p>
                <p className={`updated ${offline ? "is-offline" : ""}`} role={offline ? "status" : undefined} title={`Exact update: ${weather.current.updatedAt}`}>
                  <Icon name="clock" size={14} />
                  {offline ? `Offline · saved weather updated ${formatRelativeUpdate(weather.current, weather.location, now)}` : loading ? "Refreshing forecast…" : `Updated ${formatRelativeUpdate(weather.current, weather.location, now)}`}
                </p>
              </div>
            </div>
            <div className="current">
              <span className="temperature" key={`${weather.current.temperature}-${unit}`}>{formatTemperature(weather.current.temperature, unit)}</span>
              <div className="current-condition">
                <WeatherIcon condition={weather.current.condition} size={62} />
                <h1>{weather.current.condition.text}</h1>
              </div>
            </div>
            <p className="summary">{summary(weather, unit)}</p>
          </div>
          <div className="hero-glance" aria-label="Weather at a glance">
            <p className="glance-label">At a glance</p>
            <div className="glance-item">
              <span><Icon name="sun" size={17} />Feels like</span>
              <strong>{formatTemperature(weather.current.feelsLike, unit)}</strong>
            </div>
            <div className="glance-item">
              <span><Icon name="sunrise" size={17} />Today</span>
              <strong>{formatTemperature(today.max, unit)} <small>/ {formatTemperature(today.min, unit)}</small></strong>
            </div>
            <div className="glance-item">
              <span><Icon name="wind" size={17} />Wind</span>
              <strong>{formatWind(weather.current.windSpeed, unit)}</strong>
            </div>
          </div>
        </section>

        {(weather.alerts?.length ?? 0) > 0 && (
          <section className="weather-alerts" aria-label="Weather alerts">
            {weather.alerts?.map((alert, index) => (
              <article className="weather-alert" role="alert" key={`${alert.headline}-${alert.effective}-${index}`}>
                <p className="weather-alert-label">{alert.severity || "Weather alert"}{alert.urgency ? ` · ${alert.urgency}` : ""}</p>
                <h2>{alert.headline || alert.event}</h2>
                {alert.areas && <p className="weather-alert-areas">For {alert.areas}</p>}
                {alert.description && <p>{alert.description}</p>}
                {alert.instruction && <p><strong>What to do:</strong> {alert.instruction}</p>}
                {alert.expires && <p className="weather-alert-expires">Expires {alert.expires}</p>}
              </article>
            ))}
          </section>
        )}

        <section className="section hourly">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Hourly</span>
              <h2>Next 24 hours</h2>
            </div>
            <span className="timezone" title={weather.location.timezone}><Icon name="clock" size={14} />Local time · {formatTimezone(weather.location.timezone)}</span>
          </div>
          <div className={`hour-scroll ${hourlyEdges.left ? "can-scroll-left" : ""} ${hourlyEdges.right ? "can-scroll-right" : ""}`}>
            <div className="hour-track" ref={hourlyTrackRef} onScroll={updateHourlyEdges} onWheel={scrollHourly} onKeyDown={handleHourlyKeyDown} onPointerDown={startHourlyDrag} onPointerMove={moveHourlyDrag} onPointerUp={stopHourlyDrag} onPointerCancel={stopHourlyDrag} tabIndex={0} aria-label="Scrollable 24-hour forecast. Use left and right arrow keys to navigate." aria-keyshortcuts="ArrowLeft ArrowRight Home End">
              {hours.map((hour, index) => (
                <div className={`hour ${index === 0 ? "now" : ""}`} style={{ "--item-index": Math.min(index, 7) } as React.CSSProperties} key={hour.time}>
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
                <h2>{dailyForecast.length > 1 ? `${dailyForecast.length}-day forecast` : "Today’s forecast"}</h2>
              </div>
            </div>
            {dailyForecast.map((day, index) => {
              const left = ((day.min - forecastMin) / forecastRange) * 100;
              const width = ((day.max - day.min) / forecastRange) * 100;
              return (
                <div className={`day-row ${index === 0 ? "today" : ""}`} style={{ "--item-index": index } as React.CSSProperties} key={day.date}>
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
                  <dd><span className="detail-value">{formatTemperature(weather.current.feelsLike, unit)}</span><p>{weather.current.feelsLike > weather.current.temperature + 2 ? "Feels warmer" : weather.current.feelsLike < weather.current.temperature - 2 ? "Feels cooler" : "Close to actual"}</p><span className="detail-card-mark" aria-hidden="true"><Icon name="sun" size={36} /></span></dd>
                </div>
                <div className="detail-card humidity-card">
                  <dt><span className="detail-icon"><Icon name="humidity" /></span>Humidity</dt>
                  <dd><span className="detail-value">{weather.current.humidity}<span className="detail-unit">%</span></span><p>{weather.current.humidity < 30 ? "Dry air" : weather.current.humidity <= 60 ? "Comfortable" : "High humidity"}</p><span className="detail-meter humidity-meter" aria-hidden="true"><i style={{ width: `${Math.min(weather.current.humidity, 100)}%` }} /></span></dd>
                </div>
                <div className="detail-card wind-card">
                  <dt><span className="detail-icon"><Icon name="wind" /></span>Wind</dt>
                  <dd><span className="detail-value">{formatWind(weather.current.windSpeed, unit).split(" ")[0]}<span className="detail-unit"> {formatWind(weather.current.windSpeed, unit).split(" ").slice(1).join(" ")}</span></span><p>{weather.current.windSpeed < 12 ? "Light breeze" : weather.current.windSpeed < 30 ? "Moderate breeze" : "Strong winds"}</p><span className="detail-card-mark" aria-hidden="true"><Icon name="wind" size={36} /></span></dd>
                </div>
                <div className="detail-card uv-card">
                  <dt><span className="detail-icon"><Icon name="uv" /></span>UV index</dt>
                  <dd><span className="detail-value">{formatUV(weather.current.uv)}</span><p>{weather.current.uv < 3 ? "Low exposure" : weather.current.uv < 6 ? "Moderate exposure" : weather.current.uv < 8 ? "High exposure" : weather.current.uv < 11 ? "Very high exposure" : "Extreme exposure"}</p><span className="uv-scale" style={{ "--uv-position": `${Math.min((weather.current.uv / 11) * 100, 100)}%` } as React.CSSProperties} aria-hidden="true"><i /></span></dd>
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
                <circle className="sun-endpoint" cx="24" cy="84" r="3" />
                <circle className="sun-endpoint" cx="276" cy="84" r="3" />
                <g className="sun-marker" transform={`translate(${sunX} ${sunY})`}>
                  <circle className="sun-glow" r="13" />
                  <g className="sun-rays">
                    <path d="M0-15v-4M0 15v4M-15 0h-4M15 0h4M-10.6-10.6l-2.9-2.9M10.6 10.6l2.9 2.9M10.6-10.6l2.9-2.9M-10.6 10.6l-2.9 2.9" />
                  </g>
                  <circle className="sun-disc" r="9" />
                </g>
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
