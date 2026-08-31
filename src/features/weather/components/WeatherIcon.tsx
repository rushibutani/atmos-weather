import { useId } from "react";
import type { Condition } from "@/types/weather";
export function WeatherIcon({ condition, size = 64 }: { condition: Condition; size?: number }) {
  const gradientId = useId().replace(/:/g, "");
  const rainy = [1063,1150,1153,1180,1183,1186,1189,1192,1195,1240,1243,1246].includes(condition.code);
  const storm = [1087,1273,1276,1279,1282].includes(condition.code);
  const cloudy = [1003,1006,1009,1030,1135,1147].includes(condition.code);
  const snow = condition.code >= 1066 && condition.code <= 1237 && !rainy;
  const kind = storm ? "storm" : rainy ? "rain" : snow ? "snow" : cloudy ? "cloud" : condition.isDay ? "clear-day" : "clear-night";

  return <svg className={`weather-icon weather-${kind}`} width={size} height={size} viewBox="0 0 80 80" aria-hidden="true">
    <defs><linearGradient id={`sun-${gradientId}`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#ffd375"/><stop offset="1" stopColor="#f39a58"/></linearGradient></defs>
    {!rainy && !storm && !snow && !cloudy && <g className="weather-celestial">
      <circle className="weather-disc" cx="40" cy="40" r="18" fill={condition.isDay ? `url(#sun-${gradientId})` : "#dce8ed"}/>
      <path className="weather-rays" d="M40 8v8M40 64v8M8 40h8M64 40h8M17 17l6 6M57 57l6 6M63 17l-6 6M23 57l-6 6" stroke="currentColor" strokeWidth="3" strokeLinecap="round" opacity=".5"/>
    </g>}
    {(cloudy || rainy || storm || snow) && <g className="weather-cloud"><circle cx="29" cy="31" r="15" fill="#b9c8cb"/><path d="M21 55h39a13 13 0 0 0 0-26 20 20 0 0 0-38-1A14 14 0 0 0 21 55Z" fill="#dbe4e5" stroke="currentColor" strokeWidth="1.5"/></g>}
    {rainy && <g className="weather-drops"><path d="M28 62l-4 7"/><path d="M43 62l-4 7"/><path d="M58 62l-4 7"/></g>}
    {snow && <g className="weather-flakes"><path d="M28 62v8M24 66h8"/><path d="M49 62v8M45 66h8"/></g>}
    {storm && <path className="weather-bolt" d="M44 56h10l-9 9h7L38 77l4-14h-7Z"/>}
  </svg>;
}
