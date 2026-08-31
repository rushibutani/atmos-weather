"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import type { HistoryDay, RawWeatherResponse, Unit, WeatherData } from "@/types/weather";
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

async function loadWeather(city: string, days = 7) {
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

async function loadHistory(city: string, days: number) {
  const response = await fetch(`/api/history?city=${encodeURIComponent(city)}&days=${days}`);
  const json = await response.json();
  if (!response.ok) throw new Error(json.error ?? "Unable to load history.");
  return (json.forecast.forecastday as RawWeatherResponse["forecast"]["forecastday"]).map((day) => ({
    date: day.date,
    min: day.day.mintemp_c,
    max: day.day.maxtemp_c,
    average: day.day.avgtemp_c,
    condition: {
      ...day.day.condition,
      icon: day.day.condition.icon.startsWith("//") ? `https:${day.day.condition.icon}` : day.day.condition.icon,
      isDay: true,
    },
  }));
}

function chartPath(values: number[], width: number, height: number) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(max - min, 1);
  return values.map((value, index) => {
    const x = values.length === 1 ? width / 2 : (index / (values.length - 1)) * width;
    const y = height - ((value - min) / range) * height;
    return `${index === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(" ");
}

export function WeatherApp() {
  const [query, setQuery] = useState(DEFAULT_CITY);
  const [unit, setUnit] = useState<Unit>(savedUnit);
  const [theme, setTheme] = useState(savedTheme);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [history, setHistory] = useState<HistoryDay[]>([]);
  const [historyDays, setHistoryDays] = useState(7);
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

  useEffect(() => {
    let active = true;

    if (weather) {
      loadHistory(weather.location.city, historyDays)
        .then((days) => {
          if (active) setHistory(days);
        })
        .catch(() => {
          if (active) setHistory([]);
        });
    }

    return () => {
      active = false;
    };
  }, [historyDays, weather]);

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
    navigator.geolocation.getCurrentPosition(
      (position) => void fetchWeather(`${position.coords.latitude},${position.coords.longitude}`),
      () => setError("Location permission was denied."),
    );
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
            <span>Atmos</span>
          </a>
          <form className="search" onSubmit={onSubmit}>
            <span aria-hidden="true">Search</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Search city" />
            <button type="submit">Go</button>
          </form>
          <div className="header-actions">
            <button className="icon-button location" onClick={locate} type="button">
              <span>Use location</span>
            </button>
            <div className="segmented" aria-label="Temperature unit">
              <button className={unit === "c" ? "active" : ""} onClick={() => setUnit("c")} type="button">C</button>
              <button className={unit === "f" ? "active" : ""} onClick={() => setUnit("f")} type="button">F</button>
            </div>
            <button className="icon-button" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} type="button">
              {theme === "dark" ? "Light" : "Dark"}
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
          <button onClick={() => setError("")} type="button">Dismiss</button>
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
            <p className="updated">Updated {weather.current.updatedAt}</p>
          </div>
          <div className="hero-orbit" aria-hidden="true"><span /><span /></div>
        </section>

        <section className="section hourly">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Hourly</span>
              <h2>Next 24 hours</h2>
            </div>
            <span>{weather.location.timezone}</span>
          </div>
          <div className="hour-track">
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
                <h2>7-day forecast</h2>
              </div>
            </div>
            {weather.forecast.map((day, index) => {
              const left = ((day.min - weekMin) / Math.max(weekMax - weekMin, 1)) * 100;
              const width = ((day.max - day.min) / Math.max(weekMax - weekMin, 1)) * 100;
              return (
                <div className={`day-row ${index === 0 ? "today" : ""}`} key={day.date}>
                  <strong>{dayLabel(day.date, index === 0)}</strong>
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
            <section className="section details">
              <div className="section-heading">
                <div>
                  <span className="eyebrow">Conditions</span>
                  <h2>Current details</h2>
                </div>
              </div>
              <dl>
                <div><dt>Humidity</dt><dd>{weather.current.humidity}%</dd></div>
                <div><dt>Wind</dt><dd>{speed(weather.current.windSpeed, unit)}</dd></div>
                <div><dt>Visibility</dt><dd>{weather.current.visibility} km</dd></div>
                <div><dt>UV index</dt><dd>{weather.current.uv}</dd></div>
              </dl>
            </section>

            <section className="section sun">
              <div className="section-heading">
                <div>
                  <span className="eyebrow">Sun</span>
                  <h2>Sunrise & sunset</h2>
                </div>
              </div>
              <div className="sun-times">
                <div><span>Sunrise</span><strong>{today.sunrise}</strong></div>
                <div><span>Sunset</span><strong>{today.sunset}</strong></div>
              </div>
              <svg viewBox="0 0 300 95" role="img" aria-label="Sun path">
                <path d="M20 75 C 90 5, 210 5, 280 75" fill="none" stroke="currentColor" strokeOpacity=".25" />
                <circle cx="105" cy="31" r="9" fill="var(--sun)" />
                <path d="M18 75h264" stroke="currentColor" strokeOpacity=".2" />
              </svg>
            </section>
          </aside>
        </div>

        <section className="section history">
          <div className="section-heading">
            <div>
              <span className="eyebrow">History</span>
              <h2>Recent weather</h2>
            </div>
            <div className="range-buttons">
              {[7, 14, 30].map((days) => (
                <button className={historyDays === days ? "active" : ""} key={days} onClick={() => setHistoryDays(days)} type="button">
                  {days}d
                </button>
              ))}
            </div>
          </div>
          {history.length ? (
            <div className="chart">
              <div className="chart-legend">
                <span><i className="max" />High</span>
                <span><i className="avg" />Average</span>
                <span><i className="min" />Low</span>
              </div>
              <svg viewBox="0 0 500 230" role="img" aria-label={`${historyDays} day temperature history`}>
                <path className="line max" d={chartPath(history.map((day) => day.max), 500, 210)} />
                <path className="line avg" d={chartPath(history.map((day) => day.average), 500, 210)} />
                <path className="line min" d={chartPath(history.map((day) => day.min), 500, 210)} />
              </svg>
              <div className="history-rows">
                {history.slice(-7).map((day) => (
                  <div key={day.date}>
                    <span>{dayLabel(day.date)}</span>
                    <span>{day.condition.text}</span>
                    <strong>{temp(day.average, unit)}</strong>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="history-empty">
              <p>No historical data available.</p>
            </div>
          )}
        </section>
      </main>

      <footer>
        <span>Atmos weather dashboard</span>
        <span>Weather data from WeatherAPI.com</span>
      </footer>
    </>
  );
}
