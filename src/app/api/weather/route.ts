import { NextRequest, NextResponse } from "next/server";
import { validate, upstreamError } from "@/lib/api";

export async function GET(request: NextRequest) {
  const query = validate(request, 10, 60); if ("error" in query) return query.error;
  if (!process.env.WEATHER_API_KEY) return NextResponse.json({ error: "Weather service is not configured." }, { status: 500 });
  const url = new URL("https://api.weatherapi.com/v1/forecast.json"); url.searchParams.set("key", process.env.WEATHER_API_KEY); url.searchParams.set("q", query.city); url.searchParams.set("days", String(query.days)); url.searchParams.set("aqi", "no"); url.searchParams.set("alerts", "no");
  try {
    const response = await fetch(url, { next: { revalidate: 600 } });
    if (!response.ok) return upstreamError(response.status);
    return NextResponse.json(await response.json(), {
      headers: {
        "Cache-Control": "public, s-maxage=600, stale-while-revalidate=300",
        "CDN-Cache-Control": "public, s-maxage=600, stale-while-revalidate=300",
      },
    });
  } catch {
    return NextResponse.json({ error: "Weather data couldn't be loaded. Check your connection and try again." }, { status: 502 });
  }
}
