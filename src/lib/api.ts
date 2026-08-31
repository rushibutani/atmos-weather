import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "./rate-limit";

export function validate(request: NextRequest, maxDays: number, limit: number) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0] ?? "local";
  if (!rateLimit(`${request.nextUrl.pathname}:${ip}`, limit)) return { error: NextResponse.json({ error: "Too many requests. Please try again shortly." }, { status: 429 }) };
  const city = request.nextUrl.searchParams.get("city")?.trim().replace(/\s+/g, " ");
  const days = Number(request.nextUrl.searchParams.get("days") ?? 7);
  if (!city || city.length > 100 || !Number.isInteger(days) || days < 1 || days > maxDays) return { error: NextResponse.json({ error: "Please provide a valid city and day range." }, { status: 400 }) };
  return { city, days };
}
export function upstreamError(status: number) { const mapped = status === 400 ? 404 : status === 429 ? 429 : 502; const message = mapped === 404 ? "We couldn't find that location. Check the spelling and try again." : mapped === 429 ? "Too many requests. Try again shortly." : "Weather data is temporarily unavailable."; return NextResponse.json({ error: message }, { status: mapped }); }
