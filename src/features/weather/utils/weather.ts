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
        condition: condition(hour.condition, Boolean(hour.is_day)),
      })),
    })),
  };
}

export const temp = (celsius: number, unit: Unit) => {
  const value = unit === "c" ? celsius : celsius * 9 / 5 + 32;
  return `${Math.round(value)}\u00b0`;
};

export const speed = (kph: number, unit: Unit) => (
  unit === "c" ? `${Math.round(kph)} km/h` : `${Math.round(kph * 0.621371)} mph`
);

export const dayLabel = (date: string, today = false) => (
  today
    ? "Today"
    : new Intl.DateTimeFormat("en", { weekday: "short", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`))
);

export const hourLabel = (time: string) => (
  new Intl.DateTimeFormat("en", { hour: "numeric", hour12: true }).format(new Date(time.replace(" ", "T")))
);

export function summary(data: WeatherData) {
  const day = data.forecast[0];
  return `${day.condition.text} today. Temperatures will peak near ${Math.round(day.max)}\u00b0C this afternoon.`;
}
