export type Unit = "c" | "f";

export interface Condition {
  text: string;
  code: number;
  icon: string;
  isDay: boolean;
}

export interface HourWeather {
  time: string;
  temperature: number;
  humidity: number;
  windSpeed: number;
  condition: Condition;
}

export interface DayWeather {
  date: string;
  min: number;
  max: number;
  average: number;
  humidity: number;
  condition: Condition;
  sunrise: string;
  sunset: string;
  hours: HourWeather[];
}

export interface WeatherData {
  location: {
    city: string;
    region: string;
    country: string;
    timezone: string;
    localtime: string;
  };
  current: {
    temperature: number;
    humidity: number;
    windSpeed: number;
    uv: number;
    visibility: number;
    condition: Condition;
    updatedAt: string;
  };
  forecast: DayWeather[];
}

export interface HistoryDay {
  date: string;
  min: number;
  max: number;
  average: number;
  condition: Condition;
}

export interface RawWeatherResponse {
  location: {
    name: string;
    region?: string;
    country: string;
    tz_id: string;
    localtime: string;
  };
  current: {
    temp_c: number;
    humidity: number;
    wind_kph: number;
    uv: number;
    vis_km: number;
    last_updated: string;
    is_day: number;
    condition: {
      text: string;
      code: number;
      icon: string;
    };
  };
  forecast: {
    forecastday: Array<{
      date: string;
      day: {
        maxtemp_c: number;
        mintemp_c: number;
        avgtemp_c: number;
        avghumidity: number;
        condition: {
          text: string;
          code: number;
          icon: string;
        };
      };
      astro: {
        sunrise: string;
        sunset: string;
      };
      hour: Array<{
        time: string;
        temp_c: number;
        humidity: number;
        wind_kph: number;
        is_day: number;
        condition: {
          text: string;
          code: number;
          icon: string;
        };
      }>;
    }>;
  };
}
