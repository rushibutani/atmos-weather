import { NextRequest, NextResponse } from "next/server";
import { validate, upstreamError } from "@/lib/api";

export async function GET(request: NextRequest) {
  const query = validate(request, 30, 30); if ("error" in query) return query.error;
  if (!process.env.WEATHER_API_KEY) return NextResponse.json({ error: "Weather service is not configured." }, { status: 500 });
  const end = new Date(); end.setUTCDate(end.getUTCDate() - 1); const start = new Date(end); start.setUTCDate(start.getUTCDate() - query.days + 1);
  const url = new URL("https://api.weatherapi.com/v1/history.json"); url.searchParams.set("key", process.env.WEATHER_API_KEY); url.searchParams.set("q", query.city); url.searchParams.set("dt", start.toISOString().slice(0, 10)); url.searchParams.set("end_dt", end.toISOString().slice(0, 10));
  try { const response = await fetch(url, { next: { revalidate: 3600 } }); if (!response.ok) return upstreamError(response.status); return NextResponse.json(await response.json()); } catch { return NextResponse.json({ error: "Unable to load weather history." }, { status: 502 }); }
}
