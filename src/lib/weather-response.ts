import type { RawWeatherResponse } from "@/types/weather";

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord => (
  typeof value === "object" && value !== null
);

const isString = (value: unknown): value is string => typeof value === "string";
const isNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

function isCondition(value: unknown) {
  return isRecord(value)
    && isString(value.text)
    && isNumber(value.code)
    && isString(value.icon);
}

function isHour(value: unknown) {
  return isRecord(value)
    && isString(value.time)
    && isNumber(value.temp_c)
    && isNumber(value.humidity)
    && isNumber(value.wind_kph)
    && isNumber(value.chance_of_rain)
    && isNumber(value.chance_of_snow)
    && isNumber(value.is_day)
    && isCondition(value.condition);
}

function isForecastDay(value: unknown) {
  if (!isRecord(value) || !isRecord(value.day) || !isRecord(value.astro) || !Array.isArray(value.hour)) return false;
  return isString(value.date)
    && isNumber(value.day.maxtemp_c)
    && isNumber(value.day.mintemp_c)
    && isNumber(value.day.avgtemp_c)
    && isNumber(value.day.avghumidity)
    && isCondition(value.day.condition)
    && isString(value.astro.sunrise)
    && isString(value.astro.sunset)
    && value.hour.every(isHour);
}

export function isRawWeatherResponse(value: unknown): value is RawWeatherResponse {
  if (!isRecord(value) || !isRecord(value.location) || !isRecord(value.current) || !isRecord(value.forecast)) return false;
  return isString(value.location.name)
    && (value.location.region === undefined || isString(value.location.region))
    && isString(value.location.country)
    && isString(value.location.tz_id)
    && isString(value.location.localtime)
    && isNumber(value.current.temp_c)
    && isNumber(value.current.feelslike_c)
    && isNumber(value.current.humidity)
    && isNumber(value.current.wind_kph)
    && isNumber(value.current.uv)
    && isNumber(value.current.vis_km)
    && isNumber(value.current.is_day)
    && isString(value.current.last_updated)
    && isCondition(value.current.condition)
    && Array.isArray(value.forecast.forecastday)
    && value.forecast.forecastday.length > 0
    && value.forecast.forecastday.every(isForecastDay);
}
