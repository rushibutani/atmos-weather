import assert from "node:assert/strict";
import test from "node:test";
import { isRawWeatherResponse } from "../src/lib/weather-response.ts";

const validResponse = () => ({
  location: {
    name: "Ahmedabad",
    region: "Gujarat",
    country: "India",
    tz_id: "Asia/Kolkata",
    localtime: "2026-08-31 12:00",
  },
  current: {
    temp_c: 31,
    feelslike_c: 34,
    humidity: 60,
    wind_kph: 12,
    uv: 6,
    vis_km: 10,
    last_updated: "2026-08-31 11:45",
    is_day: 1,
    condition: { text: "Sunny", code: 1000, icon: "//cdn.weatherapi.com/icon.png" },
  },
  forecast: {
    forecastday: [{
      date: "2026-08-31",
      day: {
        maxtemp_c: 34,
        mintemp_c: 26,
        avgtemp_c: 30,
        avghumidity: 62,
        condition: { text: "Sunny", code: 1000, icon: "//cdn.weatherapi.com/icon.png" },
      },
      astro: { sunrise: "06:20 AM", sunset: "06:55 PM" },
      hour: [{
        time: "2026-08-31 12:00",
        temp_c: 31,
        humidity: 60,
        wind_kph: 12,
        chance_of_rain: 0,
        chance_of_snow: 0,
        is_day: 1,
        condition: { text: "Sunny", code: 1000, icon: "//cdn.weatherapi.com/icon.png" },
      }],
    }],
  },
  alerts: {
    alert: [],
  },
});

test("accepts a complete WeatherAPI forecast response", () => {
  assert.equal(isRawWeatherResponse(validResponse()), true);
});

test("rejects an upstream error or incomplete response", () => {
  assert.equal(isRawWeatherResponse({ error: { message: "Invalid key" } }), false);
  const incomplete = validResponse();
  delete incomplete.current.temp_c;
  assert.equal(isRawWeatherResponse(incomplete), false);
});

test("rejects non-finite numeric weather values", () => {
  const invalid = validResponse();
  invalid.current.temp_c = Number.NaN;
  assert.equal(isRawWeatherResponse(invalid), false);
});

test("validates weather alerts when the upstream response includes them", () => {
  const response = validResponse();
  response.alerts.alert.push({
    headline: "Heat warning",
    event: "Excessive Heat",
    severity: "Severe",
    urgency: "Expected",
    areas: "Ahmedabad",
    effective: "2026-08-31T12:00:00+05:30",
    expires: "2026-09-01T18:00:00+05:30",
    desc: "Dangerously hot conditions are expected.",
    instruction: "Limit time outdoors.",
  });
  assert.equal(isRawWeatherResponse(response), true);

  response.alerts.alert[0].instruction = 42;
  assert.equal(isRawWeatherResponse(response), false);
});
