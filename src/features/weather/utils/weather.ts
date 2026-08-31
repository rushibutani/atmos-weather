import type { Condition, RawWeatherResponse, Unit, WeatherData } from "@/types/weather";

const condition = (
  value: { text: string; code: number; icon: string },
  isDay: boolean,
): Condition => ({
  ...value,
  icon: value.icon.startsWith("//") ? `https:${value.icon}` : value.icon,
  isDay,
});

export function normalizeWeather(raw: RawWeatherResponse): WeatherData {
  return {
    location: {
      city: raw.location.name,
      region: raw.location.region ?? "",
      country: raw.location.country,
      timezone: raw.location.tz_id,
      localtime: raw.location.localtime,
    },
    current: {
      temperature: raw.current.temp_c,
      feelsLike: raw.current.feelslike_c,
      humidity: raw.current.humidity,
      windSpeed: raw.current.wind_kph,
      uv: raw.current.uv,
      visibility: raw.current.vis_km,
      condition: condition(raw.current.condition, Boolean(raw.current.is_day)),
      updatedAt: raw.current.last_updated,
    },
    forecast: raw.forecast.forecastday.map((day) => ({
      date: day.date,
      min: day.day.mintemp_c,
      max: day.day.maxtemp_c,
      average: day.day.avgtemp_c,
      humidity: day.day.avghumidity,
      condition: condition(day.day.condition, true),
      sunrise: day.astro.sunrise,
      sunset: day.astro.sunset,
      hours: day.hour.map((hour) => ({
        time: hour.time,
        temperature: hour.temp_c,
        humidity: hour.humidity,
        windSpeed: hour.wind_kph,
        precipitationChance: Math.max(hour.chance_of_rain ?? 0, hour.chance_of_snow ?? 0),
        condition: condition(hour.condition, Boolean(hour.is_day)),
      })),
    })),
  };
}

export const formatTemperature = (celsius: number, unit: Unit) => {
  const value = unit === "c" ? celsius : celsius * 9 / 5 + 32;
  return `${Math.round(value)}\u00b0`;
};

export const formatWind = (kph: number, unit: Unit) => (
  unit === "c" ? `${Math.round(kph)} km/h` : `${Math.round(kph * 0.621371)} mph`
);

export const formatDay = (date: string, today = false) => (
  today
    ? "Today"
    : new Intl.DateTimeFormat("en", { weekday: "short", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`))
);

export const formatTime = (time: string) => (
  new Intl.DateTimeFormat("en", { hour: "numeric", hour12: true }).format(new Date(time.replace(" ", "T")))
);

export const formatDate = (date: string) => new Intl.DateTimeFormat("en", {
  month: "short", day: "numeric", timeZone: "UTC",
}).format(new Date(`${date}T12:00:00Z`));

export const formatPrecipitation = (chance: number) => `${Math.round(chance)}%`;
export const formatVisibility = (km: number, unit: Unit) => unit === "c" ? `${Math.round(km)} km` : `${Math.round(km * 0.621371)} mi`;
export const formatUV = (value: number) => `${Math.round(value)}`;
export const formatTimezone = (timezone: string) => {
  const abbreviations: Record<string, string> = { "Asia/Kolkata": "IST", "America/New_York": "ET", "America/Chicago": "CT", "America/Denver": "MT", "America/Los_Angeles": "PT", "Europe/London": "GMT", "Europe/Paris": "CET", "Australia/Sydney": "AET" };
  return abbreviations[timezone] ?? timezone.split("/").at(-1)?.replaceAll("_", " ") ?? "local";
};

export const formatRelativeUpdate = (updatedAt: string, localtime: string) => {
  const updated = new Date(updatedAt.replace(" ", "T")).getTime();
  const local = new Date(localtime.replace(" ", "T")).getTime();
  const minutes = Math.max(0, Math.round((local - updated) / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  return `at ${new Intl.DateTimeFormat("en", { hour: "numeric", minute: "2-digit" }).format(new Date(updatedAt.replace(" ", "T")))}`;
};

export function summary(data: WeatherData, unit: Unit) {
  const day = data.forecast[0];
  const peak = `${formatTemperature(day.max, unit)}${unit.toUpperCase()}`;
  const rain = Math.max(...day.hours.map((hour) => hour.precipitationChance));
  if (rain >= 60) return `${day.condition.text} today. Rain is likely later, so keep an umbrella nearby.`;
  if (data.current.uv >= 6 && data.current.condition.isDay) return `${day.condition.text} and a high near ${peak}. UV levels will be high this afternoon.`;
  return `${day.condition.text} today. Temperatures will peak near ${peak} this afternoon.`;
}

// Backwards-compatible aliases for callers outside the main weather view.
export const temp = formatTemperature;
export const speed = formatWind;
export const dayLabel = formatDay;
export const hourLabel = formatTime;
